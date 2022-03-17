import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import WebSocket from 'ws';
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
async function sendWebsocketMessages(socket, messages) {
    const promises = [];
    while (true) {
        const result = await messages.next();
        if (socket.readyState !== 1 /* Open */) {
            await Promise.all(promises);
            return;
        }
        if (result.done) {
            await Promise.all(promises);
            if (result.value === undefined) {
                return;
            }
            return socket.close(result.value.code, result.value.reason);
        }
        const promise = socket.send(result.value);
        promises.push(promise);
    }
}
function getDefaultExceptionListener() {
    warn("default exception listener will be used. Consider overriding via the 'exceptionListener' option");
    return console.error;
}
class Socket {
    #underlying;
    #onSendError;
    uuid = randomUUID();
    constructor(underlying, onSendError) {
        this.#underlying = underlying;
        this.#onSendError = onSendError;
    }
    get readyState() {
        return this.#underlying.readyState;
    }
    async send(data) {
        const error = await new Promise(resolve => this.#underlying.send(data, resolve));
        if (error !== undefined) {
            await this.#onSendError(data, error, this.uuid);
        }
    }
    close(code, reason) {
        return new Promise(resolve => {
            this.#underlying.on('close', () => resolve());
            this.#underlying.close(code, reason);
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
            res.setHeader('Content-Length', Buffer.byteLength(state.body, 'utf-8'));
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
            const { onOpen, onMessage, onSendError, onClose } = state.body;
            const socket = new Socket(websocket, onSendError ?? defaultOnWebsocketSendError);
            sockets.set(socket.uuid, socket);
            if (onMessage !== undefined) {
                websocket.on('message', data => sendWebsocketMessages(socket, onMessage(data, socket.uuid)));
            }
            // no need to listen for the socket error event as close event is
            // always called on errors anyway. see:
            // https://github.com/websockets/ws/issues/1823#issuecomment-740056036
            const [closeReason,] = await Promise.all([
                new Promise(resolve => websocket.on('close', (...args) => resolve(args))),
                // the 'open' even is never fired when running in noServer
                // mode, so just call onOpen straight away as the request
                // is already opened
                sendWebsocketMessages(socket, onOpen(socket.uuid))
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
            await cleanup(state);
        }
    };
    return [listener, sockets];
}
export function fallthroughMessageHandler(handlers, isNext, noMatch) {
    return async (message, state, sockets) => {
        const cleanups = [];
        for (const handler of handlers) {
            const result = await handler(message, state, sockets);
            cleanups.push(result.cleanup);
            if (isNext(result.state)) {
                continue;
            }
            return composeCleanupResponse(result.state, cleanups);
        }
        return composeCleanupResponse(noMatch, cleanups);
    };
}
export function composeMessageHandlers(a, b) {
    return async (message, state, sockets) => {
        const resultA = await a(message, state, sockets);
        const resultB = await b(message, resultA.state, sockets);
        return composeCleanupResponse(resultB.state, [resultA.cleanup, resultB.cleanup]);
    };
}
export function composeResultMessageHandlers(a, b) {
    return async (message, state, sockets) => {
        const resultA = await a(message, state, sockets);
        if (!resultA.state.ok) {
            return resultA;
        }
        const resultB = await b(message, resultA.state.value, sockets);
        return composeCleanupResponse(resultB.state, [resultA.cleanup, resultB.cleanup]);
    };
}
function composeCleanupResponse(state, cleanups) {
    return response(state, async (state) => {
        for (let index = cleanups.length - 1; index >= 0; index--) {
            const cleanup = cleanups[index];
            if (cleanup === undefined) {
                continue;
            }
            await cleanup(state);
        }
    });
}
export class MessageHandlerComposer {
    #handler;
    constructor(handler) {
        this.#handler = handler;
    }
    intoHandler(other) {
        const handler = composeMessageHandlers(this.#handler, other);
        return new MessageHandlerComposer(handler);
    }
    get() {
        return this.#handler;
    }
}
export class ResultMessageHandlerComposer extends MessageHandlerComposer {
    intoResultHandler(other) {
        const handler = composeResultMessageHandlers(this.get(), other);
        return new ResultMessageHandlerComposer(handler);
    }
}
//# sourceMappingURL=server.js.map