import { Server as WebSocketServer } from 'ws';
import { asyncFallible, ok, error } from 'fallible';
import { cookieHeader } from '../utils';
export function defaultErrorHandler() {
    return {
        status: 500,
        body: 'Internal server error'
    };
}
export function defaultResponseHandler() {
    return ok({
        status: 200,
        body: ''
    });
}
export function createRequestListener({ messageHandler, responseHandler = defaultResponseHandler, errorHandler = defaultErrorHandler }) {
    return async (req, res) => {
        let response;
        try {
            const result = await asyncFallible(async (propagate) => {
                const { state, cleanup } = propagate(await messageHandler(req, {}));
                const response = await responseHandler(state);
                if (cleanup !== undefined) {
                    propagate(await cleanup());
                }
                return response;
            });
            response = result.ok
                ? result.value
                : await errorHandler(result.value);
        }
        catch (exception) {
            response = defaultErrorHandler();
        }
        res.statusCode = response.status ?? 200;
        if (response.cookies !== undefined) {
            for (const [name, cookie] of Object.entries(response.cookies)) {
                const header = cookieHeader(name, cookie);
                res.setHeader('Set-Cookie', header);
            }
        }
        if (response.headers !== undefined) {
            for (const [key, value] of Object.entries(response.headers)) {
                res.setHeader(key, value);
            }
        }
        if (typeof response.body === 'string') {
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', Buffer.byteLength(response.body));
            }
            res.end(response.body);
        }
        else if (response.body instanceof Buffer) {
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/octet-stream');
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', response.body.length);
            }
            res.end(response.body);
        }
        else if (response.body !== undefined) {
            // stream
            if ('pipe' in response.body) {
                if (!res.hasHeader('Content-Type')) {
                    res.setHeader('Content-Type', 'application/octet-stream');
                }
                response.body.pipe(res);
            }
            // websocket
            else {
                const wss = new WebSocketServer({ noServer: true });
                await new Promise(resolve => wss.handleUpgrade(req, req.socket, Buffer.alloc(0), resolve));
                const { onOpen, onMessage, onError, onClose } = response.body;
                wss.on('connection', socket => {
                    if (onOpen !== undefined) {
                        socket.on('open', onOpen);
                    }
                    if (onClose !== undefined) {
                        socket.on('close', onClose);
                    }
                    if (onError !== undefined) {
                        socket.on('error', onError);
                    }
                    socket.on('message', async (data) => {
                        for await (const response of onMessage(data)) {
                            await new Promise((resolve, reject) => socket.send(response, error => error === undefined
                                ? resolve()
                                : reject(error)));
                        }
                    });
                });
            }
        }
        else {
            res.end();
        }
    };
}
async function composeCleanups(cleanups, composeErrors) {
    const errors = [];
    for (let index = cleanups.length - 1; index >= 0; index--) {
        const result = await cleanups[index]();
        if (!result.ok) {
            errors.push(result.value);
        }
    }
    if (errors.length !== 0) {
        const composed = await composeErrors(errors);
        return error(composed);
    }
    return ok();
}
export function composeMessageHandlers(handlers, composeCleanupErrors) {
    return async (message, state) => {
        const cleanups = [];
        for (const handler of handlers) {
            const result = await handler(message, state);
            if (!result.ok) {
                return asyncFallible(async (propagate) => {
                    propagate(await composeCleanups(cleanups, composeCleanupErrors));
                    return result;
                });
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
                : () => composeCleanups(cleanups, composeCleanupErrors)
        });
    };
}
//# sourceMappingURL=index.js.map