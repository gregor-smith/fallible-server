import { pipeline } from 'stream/promises';
import Websocket from 'ws';
import { CloseWebSocket, cookieHeader } from './general-utils.js';
export function defaultOnWebsocketSendError(_, { name, message }) {
    console.warn(`Unknown error sending Websocket message. Consider adding an 'onSendError' callback to your response. Name: '${name}'. Message: '${message}'`);
}
function* iterateHeaders({ cookies, headers }) {
    if (headers !== undefined) {
        for (const [name, value] of Object.entries(headers)) {
            yield Array.isArray(value)
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
function getDefaultExceptionListener() {
    console.warn("Default exception listener will be used. Consider overriding via the 'errorHandler' option");
    return console.error;
}
export function createRequestListener({ messageHandler, exceptionListener = getDefaultExceptionListener() }) {
    return async (req, res) => {
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
                        new Promise(resolve => res.end(resolve))
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
            const server = new Websocket.Server({ noServer: true });
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
            const body = response.body;
            websocket.on('message', data => sendWebsocketMessages(websocket, body.onMessage(data), body.onSendError));
            // no need to listen for the socket error event as close event is
            // always called on errors anyway. see:
            // https://github.com/websockets/ws/issues/1823#issuecomment-740056036
            let closeReason;
            if (body.onOpen === undefined) {
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
                    sendWebsocketMessages(websocket, body.onOpen(), body.onSendError)
                ]);
            }
            if (body.onClose !== undefined) {
                await body.onClose(...closeReason);
            }
            // closing the WebSocketServer is not necessary because in noServer
            // mode all it does is terminate all connected sockets, which in
            // this case has already happened. see:
            // https://github.com/websockets/ws/blob/d1a8af4ddb1b24a4ee23acf66decb0ed0e0d8862/lib/websocket-server.js#L126
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
}
function composeCleanups(cleanups) {
    if (cleanups.length === 0) {
        return;
    }
    return async (message, state) => {
        for (let index = cleanups.length - 1; index >= 0; index--) {
            await cleanups[index](message, state);
        }
    };
}
export function composeMessageHandlers(handlers) {
    return async (message, state) => {
        const cleanups = [];
        for (const handler of handlers) {
            const result = await handler(message, state);
            state = result.state;
            if (result.cleanup !== undefined) {
                cleanups.push(result.cleanup);
            }
        }
        return {
            state,
            cleanup: composeCleanups(cleanups)
        };
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
            return {
                state: result.state,
                cleanup: composeCleanups(cleanups)
            };
        }
        return {
            state: noMatch,
            cleanup: composeCleanups(cleanups)
        };
    };
}
//# sourceMappingURL=server.js.map