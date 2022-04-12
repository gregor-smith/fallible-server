import { createHash, randomUUID } from 'node:crypto';
import stream from 'node:stream';
import WebSocket from 'ws';
import WebSocketConstants from 'ws/lib/constants.js';
import { ok, error } from 'fallible';
import { Formidable, errors as FormidableErrors } from 'formidable';
import { response } from './utils.js';
import { EMPTY_BUFFER, WEBSOCKET_DEFAULT_MAXIMUM_MESSAGE_SIZE, WEBSOCKET_GUID } from './constants.js';
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
 * returns a {@link types.MessageHandlerResult MessageHandlerResult<Response>}.
 * The result may include a {@link types.Cleanup cleanup} function, which is
 * always called after the request has ended, regardless of whether any
 * exceptions occurred.
 * See {@link types.RegularResponse RegularResponse} and
 * {@link types.WebSocketResponse WebSocketResponse} for details about
 * responses that can be returned.
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
        if ('accept' in state) {
            const { onOpen, onMessage, onSendError = defaultOnWebsocketSendError, onClose, headers, accept, protocol, maximumMessageSize = WEBSOCKET_DEFAULT_MAXIMUM_MESSAGE_SIZE, uuid = randomUUID() } = state;
            const ws = new WebSocket(null);
            const lines = [
                'HTTP/1.1 101 Switching Protocols',
                'Upgrade: websocket',
                'Connection: Upgrade',
                `Sec-WebSocket-Accept: ${accept}` // TODO: sanitise
            ];
            if (protocol !== undefined) {
                lines.push(`Sec-WebSocket-Protocol: ${protocol}`); // TODO: sanitise
                ws._protocol = protocol;
            }
            if (headers !== undefined) {
                for (let [header, value] of Object.entries(headers)) {
                    if (Array.isArray(value)) {
                        value = value.join(', ');
                    }
                    // TODO: sanitise
                    // TODO: forbid duplicates
                    lines.push(`${header}: ${value}`);
                }
            }
            lines.push('\r\n');
            const httpResponse = lines.join('\r\n');
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
                        const code = exception[WebSocketConstants.kStatusCode];
                        ws.close(code);
                    }
                    exceptionListener(exception, req, state);
                    // TODO: type possible error codes
                    const result = error(exception);
                    const promise = onClose?.(result, uuid);
                    resolve(promise);
                };
                ws.on('open', () => {
                    sockets.set(uuid, wrapper);
                    if (onOpen !== undefined) {
                        sendWebSocketMessages(wrapper, onOpen(uuid));
                    }
                });
                ws.once('error', errorListener);
                ws.on('close', closeListener);
                if (onMessage !== undefined) {
                    ws.on('message', data => {
                        sendWebSocketMessages(wrapper, onMessage(data, uuid));
                    });
                }
                ws.setSocket(req.socket, EMPTY_BUFFER, maximumMessageSize);
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
/**
 * Parses a request's `multipart/form-data` body and returns a record of files
 * and fields. Files are saved to the disk. Various limits on file and field
 * sizes and counts can be configured; see
 * {@link ParseMultipartRequestArguments}.
 *
 * Returns {@link InvalidMultipartContentTypeHeaderError} if the `Content-Type`
 * header of the request is not a valid `multipart/form-data` content type with
 * boundary.
 * Returns {@link RequestAbortedError} if the request is aborted during parsing.
 * Returns {@link BelowMinimumFileSizeError} when any file is below the
 * {@link ParseMultipartRequestArguments.minimumFileSize minimumFileSize}
 * parameter in size.
 * Returns {@link MaximumFileCountExceededError} when the number of files
 * exceeds the {@link ParseMultipartRequestArguments.maximumFileCount maximumFileCount}
 * parameter.
 * Returns {@link MaximumFileSizeExceededError} when any file exceeds the the
 * {@link ParseMultipartRequestArguments.maximumFileSize maximumFileSize}
 * parameter in size.
 * Returns {@link MaximumTotalFileSizeExceededError} when all files' combined
 * exceed the {@link ParseMultipartRequestArguments.maximumFileSize maximumFileSize} and
 * {@link ParseMultipartRequestArguments.maximumFileCount maximumFileCount}
 * parameters in size.
 * Returns {@link MaximumFieldsCountExceededError} when the number of fields
 * exceeds the {@link ParseMultipartRequestArguments.maximumFieldsCount maximumFieldsCount}
 * parameter.
 * Returns {@link MaximumFieldsSizeExceededError} when all fields combined
 * exceed the {@link ParseMultipartRequestArguments.maximumFieldsSize maximumFieldsSize}
 * parameter in size.
 * Returns {@link UnknownParseError} when an as of yet unknown error
 * occurs during parsing.
 */
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
/** A helper class for making WebSocket responses. */
export class WebSocketResponder {
    accept;
    protocol;
    constructor(
    /**
     * The string to be passed as the value of the response's
     * `Sec-WebSocket-Accept` header, created from the request's
     * `Sec-WebSocket-Key` header.
     */
    accept, 
    /**
     * The value of the request's `Sec-WebSocket-Protocol` header, to be
     * passed as the value of the response header with the same name.
     */
    protocol) {
        this.accept = accept;
        this.protocol = protocol;
    }
    /**
     * Creates a new {@link WebSocketResponder} from a request's headers and
     * method.
     *
     * Returns {@link NonGETMethodError} if the method is not `GET`.
     * Returns {@link MissingUpgradeHeaderError} if the `Upgrade` header is
     * missing.
     * Returns {@link InvalidUpgradeHeaderError} if the `Upgrade` header is not
     * `websocket`.
     * Returns {@link MissingKeyHeaderError} if the `Sec-WebSocket-Key` header
     * is missing.
     * Returns {@link InvalidKeyHeaderError} if the `Sec-WebSocket-Key` header
     * is invalid.
     * Returns {@link MissingVersionHeaderError} if the `Sec-WebSocket-Version`
     * header is missing.
     * Returns {@link InvalidOrUnsupportedVersionHeaderError} if the
     * `Sec-WebSocket-Version` header is not `8` or `13`.
     */
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
    /**
     * Creates a new
     * {@link types.MessageHandlerResult MessageHandlerResult\<WebSocketResponse>}
     * using this instance's {@link protocol} and {@link accept}.
     */
    response(options, cleanup) {
        return response({
            ...options,
            protocol: this.protocol,
            accept: this.accept
        }, cleanup);
    }
}
//# sourceMappingURL=server.js.map