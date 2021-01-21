import { Server as WebsocketServer } from 'ws';
import { error, ok } from 'fallible';
import { CloseWebSocket, cookieHeader } from './general-utils';
export function defaultErrorHandler() {
    return {
        status: 500,
        body: 'Internal server error'
    };
}
export function defaultOnWebsocketSendError(_, { name, message }) {
    console.warn(`Unknown error sending Websocket message. Consider adding an 'onSendError' callback to your response. Name: '${name}'. Message: '${message}'`);
}
function* iterateHeaders({ cookies, headers }) {
    if (headers !== undefined) {
        for (const [name, value] of Object.entries(headers)) {
            yield typeof value === 'object'
                ? [name, value.map(String)]
                : [name, String(value)];
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
async function sendWebsocketMessages(websocket, messages, onError = defaultOnWebsocketSendError) {
    while (websocket.readyState === websocket.OPEN) {
        const result = await messages.next();
        if (result.done) {
            if (result.value === CloseWebSocket) {
                websocket.close(1000); // regular close status
            }
            return;
        }
        const error = await new Promise(resolve => websocket.send(result.value, resolve));
        // the only time an error *should* occur is if the readyState changes
        // in between the message being fetched and it being sent, which is
        // definitely possible since these are both async operations.
        // the underlying socket should not throw or return an error from the
        // the send callback because the websocket listens for the socket's
        // error event, which when fired results in the websocket being closed.
        // see:
        // https://github.com/websockets/ws/blob/d1a8af4ddb1b24a4ee23acf66decb0ed0e0d8862/lib/websocket.js#L923
        // https://github.com/websockets/ws/blob/d1a8af4ddb1b24a4ee23acf66decb0ed0e0d8862/lib/websocket.js#L856
        // that said, javascript is javascript, so on the safe assumption that
        // there is some kind of unlikely albeit possible edge case, we
        // pass any unknown errors to onError and then close the connection.
        if (error !== undefined) {
            if (websocket.readyState !== websocket.OPEN) {
                return;
            }
            await onError(result.value, error);
            websocket.close(1011); // server error close status
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
            const server = new WebsocketServer({ noServer: true });
            server.on('headers', headers => {
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
            const websocket = await new Promise(resolve => server.handleUpgrade(req, req.socket, Buffer.alloc(0), resolve));
            const { onOpen, onClose, onMessage, onSendError } = response.body;
            websocket.on('message', data => sendWebsocketMessages(websocket, onMessage(data), onSendError));
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
                    sendWebsocketMessages(websocket, onOpen(), onSendError)
                ]);
            }
            if (onClose !== undefined) {
                await onClose(...closeReason);
            }
            // closing the WebSocketServer is not necessary because in noServer
            // mode all it does is terminate all connected sockets, which in
            // this case has already happened. see:
            // https://github.com/websockets/ws/blob/d1a8af4ddb1b24a4ee23acf66decb0ed0e0d8862/lib/websocket-server.js#L126
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