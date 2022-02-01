import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { ok } from 'fallible';
import { cookieHeader, response, CloseWebsocket } from './general-utils.js';
function warn(message) {
    console.warn(`fallible-server: ${message}`);
}
export function defaultOnWebsocketSendError(_data, { name, message }) {
    warn(`Unknown error sending Websocket message. Consider adding an 'onSendError' callback to your response. Name: '${name}'. Message: '${message}'`);
}
function setResponseHeaders(res, { cookies, headers }) {
    if (headers !== undefined) {
        for (const [name, value] of Object.entries(headers)) {
            const header = Array.isArray(value) ? value.map(String) : String(value);
            res.setHeader(name, header);
        }
    }
    if (cookies !== undefined) {
        const values = Object.entries(cookies)
            .map(([name, cookie]) => cookieHeader(name, cookie));
        res.setHeader('Set-Cookie', values);
    }
}
async function sendWebsocketMessages(socket, messages, onError = defaultOnWebsocketSendError) {
    const promises = [];
    while (socket.readyState === 1 /* Open */) {
        const result = await messages.next();
        if (result.done) {
            await Promise.all(promises);
            if (result.value === CloseWebsocket && socket.readyState <= 1 /* Open */) {
                await socket.close();
            }
            return;
        }
        const promise = socket.send(result.value)
            .then(error => {
            if (error !== undefined) {
                return onError(result.value, error, socket.uuid);
            }
        });
        promises.push(promise);
    }
    await Promise.all(promises);
}
function getDefaultExceptionListener() {
    warn("default exception listener will be used. Consider overriding via the 'exceptionListener' option");
    return console.error;
}
class Socket {
    constructor(wrapped) {
        this.wrapped = wrapped;
        this.uuid = randomUUID();
    }
    get readyState() {
        return this.wrapped.readyState;
    }
    send(data) {
        return new Promise(resolve => this.wrapped.send(data, resolve));
    }
    close(code, reason) {
        return new Promise(resolve => {
            this.wrapped.on('close', () => resolve());
            this.wrapped.close(code, reason);
        });
    }
}
export function createRequestListener({ messageHandler, exceptionListener = getDefaultExceptionListener() }) {
    const server = new WebSocket.Server({ noServer: true });
    const sockets = new Map();
    const listener = async (req, res) => {
        let response;
        let cleanup;
        try {
            const result = await messageHandler(req, sockets);
            response = result.state;
            cleanup = result.cleanup;
        }
        catch (exception) {
            exceptionListener(exception, req);
            try {
                if (req.aborted) {
                    if (cleanup !== undefined) {
                        await cleanup();
                    }
                }
                else {
                    res.statusCode = 500;
                    res.setHeader('Content-Length', 0);
                    await Promise.all([
                        cleanup?.(),
                        new Promise(resolve => {
                            res.on('close', resolve);
                            res.end(resolve);
                        })
                    ]);
                }
            }
            catch (exception) {
                exceptionListener(exception, req);
            }
            return;
        }
        res.statusCode = response.status ?? 200;
        if (typeof response.body === 'string') {
            setResponseHeaders(res, response);
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', Buffer.byteLength(response.body));
            }
            try {
                await new Promise(resolve => {
                    res.on('close', resolve);
                    res.end(response.body, 'utf-8', resolve);
                });
            }
            catch (exception) {
                exceptionListener(exception, req, response);
            }
        }
        else if (response.body instanceof Buffer) {
            setResponseHeaders(res, response);
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/octet-stream');
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', response.body.length);
            }
            try {
                await new Promise(resolve => {
                    res.on('close', resolve);
                    res.end(response.body, resolve);
                });
            }
            catch (exception) {
                exceptionListener(exception, req, response);
            }
        }
        // no body
        else if (response.body === undefined) {
            setResponseHeaders(res, response);
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', 0);
            }
            try {
                await new Promise(resolve => {
                    res.on('close', resolve);
                    res.end(resolve);
                });
            }
            catch (exception) {
                exceptionListener(exception, req, response);
            }
        }
        // websocket
        else if ('onMessage' in response.body) {
            const websocket = await new Promise(resolve => server.handleUpgrade(req, req.socket, Buffer.alloc(0), resolve));
            const socket = new Socket(websocket);
            sockets.set(socket.uuid, socket);
            const { onOpen, onMessage, onSendError, onClose } = response.body;
            websocket.on('message', data => sendWebsocketMessages(socket, onMessage(data, socket.uuid), onSendError));
            // no need to listen for the socket error event as close event is
            // always called on errors anyway. see:
            // https://github.com/websockets/ws/issues/1823#issuecomment-740056036
            let closeReason;
            if (onOpen === undefined) {
                closeReason = await new Promise(resolve => 
                // can't just call onClose here in this callback because
                // it's potentially async and as such needs to be awaited
                // before the final cleanup is called
                websocket.on('close', (...args) => resolve(args)));
            }
            else {
                [closeReason,] = await Promise.all([
                    new Promise(resolve => websocket.on('close', (...args) => resolve(args))),
                    // the 'open' even is never fired when running in noServer
                    // mode, so just call onOpen straight away as the request
                    // is already opened
                    sendWebsocketMessages(socket, onOpen(socket.uuid), onSendError)
                ]);
            }
            if (onClose !== undefined) {
                await onClose(...closeReason, socket.uuid);
            }
            sockets.delete(socket.uuid);
        }
        // pipeline source
        else {
            setResponseHeaders(res, response);
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/octet-stream');
            }
            try {
                await pipeline(response.body, res);
            }
            catch (exception) {
                if (exception?.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
                    exceptionListener(exception, req, response);
                }
            }
        }
        if (cleanup !== undefined) {
            await cleanup();
        }
    };
    return [listener, sockets];
}
export function composeMessageHandlers(handlers) {
    return async (message, sockets, state) => {
        const cleanups = [];
        for (const handler of handlers) {
            const result = await handler(message, sockets, state);
            if (result.cleanup !== undefined) {
                cleanups.push(result.cleanup);
            }
            state = result.state;
        }
        return composeCleanupResponse(state, cleanups);
    };
}
export function composeResultMessageHandlers(handlers) {
    return async (message, sockets, state) => {
        const cleanups = [];
        for (const handler of handlers) {
            const result = await handler(message, sockets, state);
            if (result.cleanup !== undefined) {
                cleanups.push(result.cleanup);
            }
            if (!result.state.ok) {
                return composeCleanupResponse(result.state, cleanups);
            }
            state = result.state.value;
        }
        return composeCleanupResponse(ok(state), cleanups);
    };
}
export function fallthroughMessageHandler(handlers, isNext, noMatch) {
    return async (message, sockets, state) => {
        const cleanups = [];
        for (const handler of handlers) {
            const result = await handler(message, sockets, state);
            if (result.cleanup !== undefined) {
                cleanups.push(result.cleanup);
            }
            if (isNext(result.state)) {
                continue;
            }
            return composeCleanupResponse(result.state, cleanups);
        }
        return composeCleanupResponse(noMatch, cleanups);
    };
}
function composeCleanupResponse(state, cleanups) {
    return response(state, cleanups.length === 0
        ? undefined
        : async () => {
            for (let index = cleanups.length - 1; index >= 0; index--) {
                await cleanups[index]();
            }
        });
}
//# sourceMappingURL=server.js.map