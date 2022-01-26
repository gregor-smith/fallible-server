import { pipeline } from 'stream/promises';
import Websocket from 'ws';
import { ok } from 'fallible';
import { cookieHeader, response } from './general-utils.js';
function warn(message) {
    console.warn(`fallible-server: ${message}`);
}
export function defaultOnWebsocketSendError(_, { name, message }) {
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
function send(websocket, data) {
    return new Promise(resolve => websocket.send(data, resolve));
}
async function sendAndHandleError(websocket, data, onError) {
    const error = await send(websocket, data);
    if (error === undefined) {
        return true;
    }
    await onError(data, error, websocket);
    return false;
}
async function sendWebsocketMessages(server, websocket, messages, onError = defaultOnWebsocketSendError) {
    for await (const action of messages) {
        if (websocket.readyState !== Websocket.OPEN) {
            return;
        }
        switch (action.tag) {
            case 'Message': {
                const error = await send(websocket, action.data);
                if (error !== undefined) {
                    if (websocket.readyState === Websocket.OPEN) {
                        await onError(action.data, error, websocket);
                        websocket.close(1011); // server error close status
                    }
                    return;
                }
                break;
            }
            case 'Broadcast': {
                const promises = [];
                for (const client of server.clients) {
                    if (client.readyState !== Websocket.OPEN
                        || (!action.self && client === websocket)) {
                        continue;
                    }
                    const promise = sendAndHandleError(client, action.data, onError);
                    promises.push(promise);
                }
                const results = await Promise.all(promises);
                for (const ok of results) {
                    if (ok) {
                        continue;
                    }
                    websocket.close(1011);
                    return;
                }
                break;
            }
            case 'Close': {
                websocket.close(1000); // regular close status
                return;
            }
        }
    }
}
function getDefaultExceptionListener() {
    warn("default exception listener will be used. Consider overriding via the 'exceptionListener' option");
    return console.error;
}
export function createRequestListener({ messageHandler, exceptionListener = getDefaultExceptionListener() }) {
    const server = new Websocket.Server({ noServer: true });
    const listener = async (req, res) => {
        let response;
        let cleanup;
        try {
            const result = await messageHandler(req);
            response = result.state;
            cleanup = result.cleanup;
        }
        catch (exception) {
            exceptionListener(exception, req);
            try {
                if (req.aborted) {
                    if (cleanup !== undefined) {
                        await cleanup(req);
                    }
                }
                else {
                    res.statusCode = 500;
                    res.setHeader('Content-Length', 0);
                    await Promise.all([
                        cleanup?.(req),
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
            await new Promise(resolve => {
                res.on('close', resolve);
                res.end(resolve);
            });
        }
        // websocket
        else if ('onMessage' in response.body) {
            const websocket = await new Promise(resolve => server.handleUpgrade(req, req.socket, Buffer.alloc(0), resolve));
            const { onOpen, onMessage, onSendError, onClose } = response.body;
            websocket.on('message', data => sendWebsocketMessages(server, websocket, onMessage(data), onSendError));
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
                    sendWebsocketMessages(server, websocket, onOpen(), onSendError)
                ]);
            }
            if (onClose !== undefined) {
                await onClose(...closeReason);
            }
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
                    throw exception;
                }
            }
        }
        if (cleanup !== undefined) {
            await cleanup(req, response);
        }
    };
    const cleanup = () => new Promise(resolve => server.close(resolve));
    return [listener, cleanup];
}
export function composeMessageHandlers(handlers) {
    return async (message, state) => {
        const cleanups = [];
        for (const handler of handlers) {
            const result = await handler(message, state);
            if (result.cleanup !== undefined) {
                cleanups.push(result.cleanup);
            }
            state = result.state;
        }
        return composeCleanupResponse(state, cleanups);
    };
}
export function composeResultMessageHandlers(handlers) {
    return async (message, state) => {
        const cleanups = [];
        for (const handler of handlers) {
            const result = await handler(message, state);
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
    return async (message, state) => {
        const cleanups = [];
        for (const handler of handlers) {
            const result = await handler(message, state);
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
        : async (message, state) => {
            for (let index = cleanups.length - 1; index >= 0; index--) {
                await cleanups[index](message, state);
            }
        });
}
//# sourceMappingURL=server.js.map