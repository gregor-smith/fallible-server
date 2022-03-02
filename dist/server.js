import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import WebSocket from 'ws';
import { ok } from 'fallible';
import { response } from './general-utils.js';
function warn(message) {
    console.warn(`fallible-server: ${message}`);
}
function defaultOnWebsocketSendError(_data, { name, message }) {
    warn("Unknown error sending Websocket message. Consider adding an 'onSendError' callback to your response");
    warn(name);
    warn(message);
}
function setResponseHeaders(res, headers) {
    if (headers !== undefined) {
        for (const [name, value] of Object.entries(headers)) {
            const header = Array.isArray(value) ? value.map(String) : String(value);
            res.setHeader(name, header);
        }
    }
}
async function sendAndHandleError(socket, data, onError) {
    const error = await socket.send(data);
    if (error !== undefined) {
        return onError(data, error, socket.uuid);
    }
}
async function sendWebsocketMessages(socket, messages, onError = defaultOnWebsocketSendError) {
    const promises = [];
    for await (const message of messages) {
        if (socket.readyState !== 1 /* Open */) {
            break;
        }
        const promise = sendAndHandleError(socket, message, onError);
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
export function createRequestListener(messageHandler, exceptionListener = getDefaultExceptionListener()) {
    const server = new WebSocket.Server({ noServer: true });
    const sockets = new Map();
    const listener = async (req, res) => {
        let state;
        let cleanup;
        try {
            ({ state, cleanup } = await messageHandler(req, undefined, sockets));
        }
        catch (exception) {
            exceptionListener(exception, req);
            state = { status: 500 };
        }
        res.statusCode = state.status ?? 200;
        if (typeof state.body === 'string') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Length', Buffer.byteLength(state.body));
            setResponseHeaders(res, state.headers);
            try {
                await new Promise((resolve, reject) => {
                    res.on('close', resolve);
                    res.on('error', reject);
                    res.end(state.body, 'utf-8');
                });
            }
            catch (exception) {
                exceptionListener(exception, req, state);
            }
        }
        else if (state.body instanceof Uint8Array) {
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', state.body.byteLength);
            setResponseHeaders(res, state.headers);
            try {
                await new Promise((resolve, reject) => {
                    res.on('close', resolve);
                    res.on('error', reject);
                    res.end(state.body);
                });
            }
            catch (exception) {
                exceptionListener(exception, req, state);
            }
        }
        // no body
        else if (state.body === undefined) {
            res.setHeader('Content-Length', 0);
            setResponseHeaders(res, state.headers);
            try {
                await new Promise((resolve, reject) => {
                    res.on('close', resolve);
                    res.on('error', reject);
                    res.end();
                });
            }
            catch (exception) {
                exceptionListener(exception, req, state);
            }
        }
        // websocket
        else if ('onOpen' in state.body) {
            const websocket = await new Promise(resolve => server.handleUpgrade(req, req.socket, Buffer.alloc(0), resolve));
            const socket = new Socket(websocket);
            sockets.set(socket.uuid, socket);
            const { onOpen, onMessage, onSendError, onClose } = state.body;
            if (onMessage !== undefined) {
                websocket.on('message', data => sendWebsocketMessages(socket, onMessage(data, socket.uuid), onSendError));
            }
            // no need to listen for the socket error event as close event is
            // always called on errors anyway. see:
            // https://github.com/websockets/ws/issues/1823#issuecomment-740056036
            const [closeReason,] = await Promise.all([
                new Promise(resolve => websocket.on('close', (...args) => resolve(args))),
                // the 'open' even is never fired when running in noServer
                // mode, so just call onOpen straight away as the request
                // is already opened
                sendWebsocketMessages(socket, onOpen(socket.uuid), onSendError)
            ]);
            sockets.delete(socket.uuid);
            if (onClose !== undefined) {
                await onClose(...closeReason, socket.uuid);
            }
        }
        // iterable
        else {
            res.setHeader('Content-Type', 'application/octet-stream');
            setResponseHeaders(res, state.headers);
            const iterable = typeof state.body === 'function'
                ? state.body()
                : state.body;
            const stream = iterable instanceof Readable
                ? iterable
                : Readable.from(iterable, { objectMode: false });
            try {
                await new Promise((resolve, reject) => {
                    const errorHandler = (error) => {
                        res.off('error', errorHandler);
                        stream.off('error', errorHandler);
                        stream.unpipe(res);
                        res.end();
                        reject(error);
                    };
                    res.on('close', resolve);
                    res.once('error', errorHandler);
                    stream.once('error', errorHandler);
                    stream.pipe(res);
                });
            }
            catch (exception) {
                exceptionListener(exception, req, state);
            }
        }
        if (cleanup !== undefined) {
            await cleanup();
        }
    };
    return [listener, sockets];
}
export function composeMessageHandlers(handlers) {
    return async (message, state, sockets) => {
        const cleanups = [];
        for (const handler of handlers) {
            const result = await handler(message, state, sockets);
            if (result.cleanup !== undefined) {
                cleanups.push(result.cleanup);
            }
            state = result.state;
        }
        return composeCleanupResponse(state, cleanups);
    };
}
export function composeResultMessageHandlers(handlers) {
    return async (message, state, sockets) => {
        const cleanups = [];
        for (const handler of handlers) {
            const result = await handler(message, state, sockets);
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
    return async (message, state, sockets) => {
        const cleanups = [];
        for (const handler of handlers) {
            const result = await handler(message, state, sockets);
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
    return response(state, async () => {
        for (let index = cleanups.length - 1; index >= 0; index--) {
            await cleanups[index]();
        }
    });
}
//# sourceMappingURL=server.js.map