import { Server as WebSocketServer } from 'ws';
import { error, ok } from 'fallible';
import { CloseWebSocket, cookieHeader } from './general-utils';
export function defaultErrorHandler() {
    return {
        status: 500,
        body: 'Internal server error'
    };
}
function setHeaders(response, { cookies, headers }) {
    if (cookies !== undefined) {
        for (const [name, cookie] of Object.entries(cookies)) {
            const header = cookieHeader(name, cookie);
            response.setHeader('Set-Cookie', header);
        }
    }
    if (headers !== undefined) {
        for (const [key, value] of Object.entries(headers)) {
            response.setHeader(key, String(value));
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
            setHeaders(res, response);
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', Buffer.byteLength(response.body));
            }
            await new Promise(resolve => res.end(response.body, resolve));
        }
        else if (response.body instanceof Buffer) {
            setHeaders(res, response);
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/octet-stream');
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', response.body.length);
            }
            await new Promise(resolve => res.end(response.body, resolve));
        }
        else if (response.body !== undefined) {
            // stream
            if ('pipe' in response.body) {
                setHeaders(res, response);
                if (!res.hasHeader('Content-Type')) {
                    res.setHeader('Content-Type', 'application/octet-stream');
                }
                await new Promise(resolve => {
                    response.body.on('end', resolve);
                    response.body.pipe(res);
                });
            }
            // websocket
            else {
                const wss = new WebSocketServer({ noServer: true });
                wss.on('headers', headers => {
                    if (response.cookies !== undefined) {
                        for (const [name, cookie] of Object.entries(response.cookies)) {
                            const header = cookieHeader(name, cookie);
                            headers.push(`Set-Cookie: ${header}`);
                        }
                    }
                    if (response.headers !== undefined) {
                        for (const [key, value] of Object.entries(response.headers)) {
                            headers.push(`${key}: ${value}`);
                        }
                    }
                });
                const socket = await new Promise(resolve => wss.handleUpgrade(req, req.socket, Buffer.alloc(0), resolve));
                const { onOpen, onClose, onError, onMessage, onSendError } = response.body;
                const sendMessages = async (generator) => {
                    while (true) {
                        const result = await generator.next();
                        if (result.done) {
                            if (result.value === CloseWebSocket) {
                                socket.close(1000);
                            }
                            return;
                        }
                        const error = await new Promise(resolve => socket.send(result.value, resolve));
                        if (error !== undefined && onSendError !== undefined) {
                            await onSendError(result.value, error);
                        }
                    }
                };
                if (onClose !== undefined) {
                    socket.addListener('close', onClose);
                }
                if (onError !== undefined) {
                    socket.on('error', onError);
                }
                socket.on('message', data => {
                    const generator = onMessage(data);
                    return sendMessages(generator);
                });
                if (onOpen === undefined) {
                    await new Promise(resolve => socket.addListener('close', resolve));
                }
                else {
                    // the 'open' even is never fired in this case, so just
                    // call onOpen immediately
                    const generator = onOpen();
                    await Promise.all([
                        new Promise(resolve => socket.addListener('close', resolve)),
                        sendMessages(generator)
                    ]);
                }
            }
        }
        // no body
        else {
            setHeaders(res, response);
            await new Promise(resolve => res.end(resolve));
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