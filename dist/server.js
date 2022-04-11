import { createHash, randomUUID } from 'node:crypto';
import stream from 'node:stream';
import WebSocket from 'ws';
import { ok, error } from 'fallible';
import { Formidable, errors as FormidableErrors } from 'formidable';
import { response } from './utils.js';
import { WEBSOCKET_DEFAULT_MAXIMUM_MESSAGE_SIZE, WEBSOCKET_GUID } from './constants.js';
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
async function sendWebSocketMessages(socket, messages) {
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
class WebSocketWrapper {
    uuid;
    #underlying;
    #onSendError;
    constructor(underlying, onSendError, uuid) {
        this.uuid = uuid;
        this.#underlying = underlying;
        this.#onSendError = onSendError;
    }
    get readyState() {
        return this.#underlying.readyState;
    }
    async send(data) {
        let error;
        try {
            error = await new Promise(resolve => this.#underlying.send(data, resolve));
        }
        catch (e) {
            if (!(e instanceof Error)) {
                throw e;
            }
            error = e;
        }
        if (error !== undefined) {
            await this.#onSendError(data, error, this.uuid);
        }
    }
    close(code, reason) {
        return new Promise(resolve => {
            this.#underlying.on('close', resolve);
            this.#underlying.close(code, reason);
        });
    }
}
/**
 * Creates a callback intended to be added as a listener to the `request` event
 * of an {@link http.Server}.
 * @param messageHandler
 * A function that takes an {@link http.IncomingMessage IncomingMessage} and
 * returns a {@link types.MessageHandlerResult MessageHandlerResult}. The
 * result may include a {@link types.Cleanup cleanup} function, which is always
 * called after the request has ended, regardless of whether any exceptions
 * occurred. The `Content-Type` header is set by default depending on type of
 * the {@link types.Response response} body: `string` bodies default to
 * `text/html; charset=utf8` while {@link Uint8Array} and
 * {@link types.StreamBody stream} bodies default to `application/octet-stream`.
 * The 'Content-Length' header is also set for all except stream and WebSocket
 * bodies.
 *
 * @param exceptionListener
 * A function called when the message handler throws or the
 * {@link http.ServerResponse ServerResponse} fires an `error` event. If not
 * given, a warning is printed and {@link console.error} is used.
 * @returns
 * The callback, and a map of all active WebSockets identified by UUIDs.
 */
export function createRequestListener(messageHandler, exceptionListener = getDefaultExceptionListener()) {
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
        // websocket
        if ('onOpen' in state) {
            const { onOpen, onMessage, onSendError = defaultOnWebsocketSendError, onClose, headers, protocol, maximumMessageSize = WEBSOCKET_DEFAULT_MAXIMUM_MESSAGE_SIZE, uuid = randomUUID() } = state;
            const lines = [
                'HTTP/1.1 101 Switching Protocols',
                'Upgrade: websocket',
                'Connection: Upgrade',
            ];
            for (let [header, value] of Object.entries(headers)) {
                if (Array.isArray(value)) {
                    value = value.join(', ');
                }
                // TODO: sanitise headers, forbid upgrade/connection
                lines.push(`${header}: ${value}`);
            }
            lines.push('\r\n');
            const httpResponse = lines.join('\r\n');
            const ws = new WebSocket(null);
            if (protocol !== undefined) {
                ws._protocol = protocol;
            }
            const wrapper = new WebSocketWrapper(ws, onSendError, uuid);
            await new Promise(resolve => {
                const closeListener = (code, reason) => {
                    sockets.delete(uuid);
                    ws.off('error', errorListener);
                    const result = ok({ code, reason });
                    const promise = onClose?.(result, uuid);
                    resolve(promise);
                };
                const errorListener = (exception) => {
                    sockets.delete(uuid);
                    ws.off('close', closeListener);
                    if (ws.readyState < 2 /* Closing */) {
                        ws.close();
                    }
                    exceptionListener(exception, req, state);
                    // TODO: type possible error codes
                    const result = error(exception);
                    const promise = onClose?.(result, uuid);
                    resolve(promise);
                };
                ws.on('open', () => {
                    sockets.set(uuid, wrapper);
                    sendWebSocketMessages(wrapper, onOpen(uuid));
                });
                ws.once('error', errorListener);
                ws.on('close', closeListener);
                if (onMessage !== undefined) {
                    ws.on('message', data => {
                        sendWebSocketMessages(wrapper, onMessage(data, uuid));
                    });
                }
                ws.setSocket(req.socket, Buffer.alloc(0), maximumMessageSize);
                req.socket.write(httpResponse);
            });
        }
        else {
            res.statusCode = state.status ?? 200;
            const body = state.body;
            if (typeof body === 'string') {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.setHeader('Content-Length', Buffer.byteLength(body, 'utf-8'));
                setResponseHeaders(res, state.headers);
                try {
                    await new Promise((resolve, reject) => {
                        res.on('close', resolve);
                        res.on('error', reject);
                        res.end(body, 'utf-8');
                    });
                }
                catch (exception) {
                    exceptionListener(exception, req, state);
                }
            }
            else if (body instanceof Uint8Array) {
                res.setHeader('Content-Type', 'application/octet-stream');
                res.setHeader('Content-Length', body.byteLength);
                setResponseHeaders(res, state.headers);
                try {
                    await new Promise((resolve, reject) => {
                        res.on('close', resolve);
                        res.on('error', reject);
                        res.end(body);
                    });
                }
                catch (exception) {
                    exceptionListener(exception, req, state);
                }
            }
            else if (body === undefined) {
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
            // stream
            else {
                res.setHeader('Content-Type', 'application/octet-stream');
                setResponseHeaders(res, state.headers);
                const iterable = typeof body === 'function' ? body() : body;
                const readable = iterable instanceof stream.Readable
                    ? iterable
                    : stream.Readable.from(iterable, { objectMode: false });
                try {
                    await new Promise((resolve, reject) => {
                        const errorHandler = (error) => {
                            res.off('error', errorHandler);
                            readable.off('error', errorHandler);
                            readable.unpipe(res);
                            res.end();
                            reject(error);
                        };
                        res.on('close', resolve);
                        res.once('error', errorHandler);
                        readable.once('error', errorHandler);
                        readable.pipe(res);
                    });
                }
                catch (exception) {
                    exceptionListener(exception, req, state);
                }
            }
        }
        if (cleanup !== undefined) {
            await cleanup(state);
        }
    };
    return [listener, sockets];
}
// TODO: replace with async generator
export function parseMultipartRequest(request, { encoding = 'utf-8', saveDirectory, keepFileExtensions = false, minimumFileSize = 0, maximumFileCount = Infinity, maximumFileSize = Infinity, maximumFieldsCount = Infinity, maximumFieldsSize = Infinity } = {}) {
    return new Promise(resolve => {
        new Formidable({
            enabledPlugins: ['multipart'],
            encoding,
            keepExtensions: keepFileExtensions,
            uploadDir: saveDirectory,
            allowEmptyFiles: true,
            minFileSize: minimumFileSize,
            maxFiles: maximumFileCount,
            maxFileSize: maximumFileSize,
            maxTotalFileSize: maximumFileCount * maximumFileSize,
            maxFields: maximumFieldsCount,
            maxFieldsSize: maximumFieldsSize
        }).parse(request, (exception, fields, files) => {
            if (exception !== null && exception !== undefined) {
                return resolve(error(getMultipartError(exception)));
            }
            const newFiles = {};
            for (const [name, file] of Object.entries(files)) {
                newFiles[name] = {
                    size: file.size,
                    path: file.filepath,
                    mimetype: file.mimetype,
                    dateModified: file.lastModifiedDate
                };
            }
            resolve(ok({
                fields,
                files: newFiles
            }));
        });
    });
}
function getMultipartError(error) {
    if (!(error instanceof FormidableErrors.default)) {
        return { tag: 'UnknownError', error };
    }
    switch (error.code) {
        case FormidableErrors.malformedMultipart:
            return { tag: 'InvalidMultipartContentTypeHeader' };
        case FormidableErrors.aborted:
            return { tag: 'RequestAborted' };
        case FormidableErrors.maxFilesExceeded:
            return { tag: 'MaximumFileCountExceeded' };
        case FormidableErrors.biggerThanMaxFileSize:
            return { tag: 'MaximumFileSizeExceeded' };
        case FormidableErrors.biggerThanTotalMaxFileSize:
            return { tag: 'MaximumTotalFileSizeExceeded' };
        case FormidableErrors.maxFieldsExceeded:
            return { tag: 'MaximumFieldsCountExceeded' };
        case FormidableErrors.maxFieldsSizeExceeded:
            return { tag: 'MaximumFieldsSizeExceeded' };
        case FormidableErrors.smallerThanMinFileSize:
            return { tag: 'BelowMinimumFileSize' };
        default:
            return { tag: 'UnknownError', error };
    }
}
export class WebSocketResponder {
    accept;
    protocol;
    constructor(accept, protocol) {
        this.accept = accept;
        this.protocol = protocol;
    }
    static fromHeaders(method, headers) {
        if (method !== 'GET') {
            return error({
                tag: 'NonGETMethod',
                method
            });
        }
        if (headers.upgrade === undefined) {
            return error({ tag: 'MissingUpgradeHeader' });
        }
        if (headers.upgrade.toLowerCase() !== 'websocket') {
            return error({
                tag: 'InvalidUpgradeHeader',
                header: headers.upgrade
            });
        }
        const key = headers['sec-websocket-key'];
        if (key === undefined) {
            return error({ tag: 'MissingKeyHeader' });
        }
        if (!/^[+/0-9a-z]{22}==$/i.test(key)) {
            return error({
                tag: 'InvalidKeyHeader',
                header: key
            });
        }
        if (headers['sec-websocket-version'] === undefined) {
            return error({ tag: 'MissingVersionHeader' });
        }
        // ws only supports 8 and 13
        if (!/^(?:8|13)$/.test(headers['sec-websocket-version'])) {
            return error({
                tag: 'InvalidOrUnsupportedVersionHeader',
                header: headers['sec-websocket-version']
            });
        }
        const accept = createHash('sha1')
            .update(key + WEBSOCKET_GUID)
            .digest('base64');
        const protocol = headers['sec-websocket-protocol']
            ?.match(/^(.+?)(?:,|$)/)?.[1];
        const responder = new WebSocketResponder(accept, protocol);
        return ok(responder);
    }
    response(options, cleanup) {
        const headers = {
            'Sec-WebSocket-Accept': this.accept
        };
        if (this.protocol !== undefined) {
            headers['Sec-WebSocket-Protocol'] = this.protocol;
        }
        return response({
            ...options,
            headers: { ...headers, ...options.headers },
            protocol: this.protocol
        }, cleanup);
    }
}
//# sourceMappingURL=server.js.map