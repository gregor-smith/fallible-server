import { createHash, randomUUID } from 'node:crypto';
import stream from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import WebSocket from 'ws';
import { ok, error } from 'fallible';
import { Formidable, errors as FormidableErrors } from 'formidable';
import { Headers } from 'headers-polyfill';
import { EMPTY_BUFFER, WEBSOCKET_DEFAULT_MAXIMUM_MESSAGE_SIZE, WEBSOCKET_GUID, WEBSOCKET_RAW_RESPONSE_BASE } from './constants.js';
function warn(message) {
    console.warn(`fallible-server: ${message}`);
}
function checkForReservedHeader(headers, header) {
    if (headers.has(header)) {
        warn(`Reserved header '${header}' should not be set`);
    }
}
function setResponseHeaders(res, headers) {
    headers?.forEach((value, header) => res.setHeader(header, value));
}
function getDefaultExceptionListener() {
    warn("default exception listener will be used. Consider overriding via the 'exceptionListener' option");
    return console.error;
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
            const { callback, accept, protocol, maximumMessageSize = WEBSOCKET_DEFAULT_MAXIMUM_MESSAGE_SIZE, uuid = randomUUID() } = state;
            let { headers } = state;
            if (headers === undefined) {
                headers = new Headers();
            }
            else {
                checkForReservedHeader(headers, 'Upgrade');
                checkForReservedHeader(headers, 'Connection');
                checkForReservedHeader(headers, 'Sec-WebSocket-Accept');
                checkForReservedHeader(headers, 'Sec-WebSocket-Protocol');
            }
            headers.set('Sec-WebSocket-Accept', accept);
            const socket = new WebSocket(null);
            if (protocol !== undefined) {
                headers.set('Sec-WebSocket-Protocol', protocol);
                socket._protocol = protocol;
            }
            let response = WEBSOCKET_RAW_RESPONSE_BASE;
            headers.forEach((value, header) => {
                response = `${response}${header}: ${value}\r\n`;
            });
            response = `${response}\r\n`;
            await new Promise(resolve => {
                socket.on('open', () => {
                    sockets.set(uuid, socket);
                });
                socket.on('close', () => {
                    sockets.delete(uuid);
                    resolve(callbackPromise);
                });
                socket.setSocket(req.socket, EMPTY_BUFFER, maximumMessageSize);
                req.socket.write(response);
                const callbackPromise = callback?.(uuid, socket);
            });
        }
        else {
            const { headers, status = 200, body } = state;
            res.statusCode = status;
            if (typeof body === 'string') {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.setHeader('Content-Length', Buffer.byteLength(body, 'utf-8'));
                setResponseHeaders(res, headers);
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
                setResponseHeaders(res, headers);
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
            else if (body == null) {
                res.setHeader('Content-Length', 0);
                setResponseHeaders(res, headers);
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
                setResponseHeaders(res, headers);
                const iterable = typeof body === 'function' ? body() : body;
                let readable;
                if (iterable instanceof stream.Readable) {
                    readable = iterable;
                }
                else if (iterable instanceof ReadableStream) {
                    readable = stream.Readable.fromWeb(iterable, { objectMode: false });
                }
                else {
                    readable = stream.Readable.from(iterable, { objectMode: false });
                }
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
 * Returns {@link MaximumFileSizeExceededError} when any file exceeds the
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
/**
 * Parses the {@link ParsedWebSocketHeaders `accept` and `protocol` fields}
 * required for a {@link WebSocketResponse} from a request's headers.
 *
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
export function parseWebSocketHeaders(headers) {
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
    return ok({ accept, protocol });
}
//# sourceMappingURL=server.js.map