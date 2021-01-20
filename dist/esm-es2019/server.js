import { Server as WebSocketServer } from 'ws';
import { error, ok } from 'fallible';
import { CloseWebSocket, cookieHeader } from './general-utils';
export function defaultErrorHandler() {
    return {
        status: 500,
        body: 'Internal server error'
    };
}
function* iterateHeaders({ cookies, headers }) {
    if (headers !== undefined) {
        for (const [name, value] of Object.entries(headers)) {
            if (typeof value === 'object') {
                yield [name, value.map(String)];
            }
            else {
                yield [name, String(value)];
            }
        }
    }
    if (cookies !== undefined) {
        const values = Object.entries(cookies)
            .map(([name, cookie]) => cookieHeader(name, cookie));
        yield ['Set-Cookie', values];
    }
}
function setResponseHeaders(res, response) {
    for (const [name, values] of iterateHeaders(response)) {
        res.setHeader(name, values);
    }
}
async function sendWebsocketMessages(socket, messages, onError) {
    while (true) {
        const result = await messages.next();
        if (result.done) {
            if (result.value === CloseWebSocket) {
                socket.close(1000);
            }
            return;
        }
        const error = await new Promise(resolve => socket.send(result.value, resolve));
        if (error !== undefined && onError !== undefined) {
            await onError(result.value, error);
        }
    }
}
export function createRequestListener({ messageHandler, errorHandler = defaultErrorHandler, exceptionHandler = defaultErrorHandler }) {
    return async (req, res) => {
        var _a;
        let response;
        let cleanup;
        try {
            const result = await messageHandler(req);
            if (result.ok) {
                response = result.value.state;
                cleanup = result.value.cleanup;
            }
            else {
                response = await errorHandler(result.value);
            }
        }
        catch (exception) {
            response = await exceptionHandler(exception);
        }
        res.statusCode = (_a = response.status) !== null && _a !== void 0 ? _a : 200;
        if (typeof response.body === 'string') {
            setResponseHeaders(res, response);
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', Buffer.byteLength(response.body));
            }
            await new Promise(resolve => res.end(response.body, resolve));
        }
        else if (response.body instanceof Buffer) {
            setResponseHeaders(res, response);
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/octet-stream');
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', response.body.length);
            }
            await new Promise(resolve => res.end(response.body, resolve));
        }
        // no body
        else if (response.body === undefined) {
            setResponseHeaders(res, response);
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', 0);
            }
            await new Promise(resolve => res.end(resolve));
        }
        // stream
        else if ('pipe' in response.body) {
            setResponseHeaders(res, response);
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/octet-stream');
            }
            await new Promise(resolve => {
                res.on('finish', resolve);
                response.body.pipe(res);
            });
        }
        // websocket
        else {
            const wss = new WebSocketServer({ noServer: true });
            wss.on('headers', headers => {
                for (const [name, values] of iterateHeaders(response)) {
                    if (typeof values === 'string') {
                        headers.push(`${name}: ${values}`);
                    }
                    else {
                        for (const value of values) {
                            headers.push(`${name}: ${value}`);
                        }
                    }
                }
            });
            const socket = await new Promise(resolve => wss.handleUpgrade(req, req.socket, Buffer.alloc(0), resolve));
            const { onOpen, onClose, onMessage, onSendError } = response.body;
            socket.on('message', data => sendWebsocketMessages(socket, onMessage(data), onSendError));
            // no need to listen for the socket error event as apparently the
            // close event is always called on errors anyway. see:
            // https://github.com/websockets/ws/issues/1823#issuecomment-740056036
            let closeReason;
            if (onOpen === undefined) {
                closeReason = await new Promise(resolve => 
                // can't just call onClose here in this callback because
                // it's potentially async and as such needs to be awaited
                // before the final cleanup is called
                socket.on('close', (...args) => resolve(args)));
            }
            else {
                [closeReason,] = await Promise.all([
                    new Promise(resolve => socket.on('close', (...args) => resolve(args))),
                    // the 'open' even is never fired when running in noServer
                    // mode as we are, so just call onOpen straight away as the
                    // request is already opened
                    sendWebsocketMessages(socket, onOpen(), onSendError)
                ]);
            }
            if (onClose !== undefined) {
                await onClose(...closeReason);
            }
        }
        if (cleanup !== undefined) {
            await cleanup(response);
        }
    };
}
function composedCleanups(cleanups) {
    return async (response) => {
        for (let index = cleanups.length - 1; index >= 0; index--) {
            await cleanups[index](response);
        }
    };
}
export function composeMessageHandlers(handlers) {
    return async (message, state) => {
        const cleanups = [];
        for (const handler of handlers) {
            const result = await handler(message, state);
            if (!result.ok) {
                await composedCleanups(cleanups)();
                return result;
            }
            state = result.value.state;
            if (result.value.cleanup !== undefined) {
                cleanups.push(result.value.cleanup);
            }
        }
        return ok({
            state,
            cleanup: cleanups.length === 0
                ? undefined
                : composedCleanups(cleanups)
        });
    };
}
export function fallthroughMessageHandler(handlers, isNext, noMatch) {
    return async (message, state) => {
        for (const handler of handlers) {
            const result = await handler(message, state);
            if (result.ok || !isNext(result.value)) {
                return result;
            }
        }
        return error(noMatch());
    };
}
//# sourceMappingURL=server.js.map