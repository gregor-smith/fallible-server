import type http from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import stream from 'node:stream'
import { ReadableStream } from 'node:stream/web'
import type { Socket } from 'node:net'

import WebSocket from 'ws'
import { Result, ok, error } from 'fallible'
import { Formidable, errors as FormidableErrors } from 'formidable'
import { Headers } from 'headers-polyfill'

import type * as types from './types.js'
import {
    EMPTY_BUFFER,
    WEBSOCKET_DEFAULT_MAXIMUM_INCOMING_MESSAGE_SIZE,
    WEBSOCKET_GUID,
    WEBSOCKET_RAW_RESPONSE_BASE
} from './constants.js'


function warn(message: string): void {
    console.warn(`fallible-server: ${message}`)
}


function checkForReservedHeader(headers: types.Headers, header: string): void {
    if (headers.has(header)) {
        warn(`Reserved header '${header}' should not be set`)
    }
}


function setResponseHeaders(
    res: http.ServerResponse,
    headers: types.Headers | undefined
): void {
    headers?.forEach((value, header) => res.setHeader(header, value))
}


function getDefaultExceptionListener(): types.ExceptionListener {
    warn("default exception listener will be used. Consider overriding via the 'exceptionListener' option")
    return console.error
}


interface InternalWebSocket extends WebSocket {
    _protocol: string

    setSocket(socket: Socket, head: Buffer, maximumMessageSize: number): void
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
export function createRequestListener(
    messageHandler: types.MessageHandler,
    exceptionListener = getDefaultExceptionListener()
): [ types.AwaitableRequestListener, types.SocketMap ] {
    const sockets = new Map<string, WebSocket>()

    const listener: types.AwaitableRequestListener = async (req, res) => {
        let state: types.Response
        let cleanup: types.Cleanup | undefined
        try {
            ({ state, cleanup } = await messageHandler(req, undefined, sockets))
        }
        catch (exception) {
            exceptionListener(exception, req)
            state = { status: 500 }
        }

        // websocket
        if ('accept' in state) {
            const {
                callback,
                accept,
                protocol,
                maximumIncomingMessageSize = WEBSOCKET_DEFAULT_MAXIMUM_INCOMING_MESSAGE_SIZE,
                uuid = randomUUID()
            } = state
            let { headers } = state

            if (headers === undefined) {
                headers = new Headers()
            }
            else {
                checkForReservedHeader(headers, 'Upgrade')
                checkForReservedHeader(headers, 'Connection')
                checkForReservedHeader(headers, 'Sec-WebSocket-Accept')
                checkForReservedHeader(headers, 'Sec-WebSocket-Protocol')
            }
            headers.set('Sec-WebSocket-Accept', accept)

            const socket = new WebSocket(null) as InternalWebSocket
            if (protocol !== undefined) {
                headers.set('Sec-WebSocket-Protocol', protocol)
                socket._protocol = protocol
            }

            let response = WEBSOCKET_RAW_RESPONSE_BASE
            headers.forEach((value, header) => {
                response = `${response}${header}: ${value}\r\n`
            })
            response = `${response}\r\n`

            await new Promise<void>(resolve => {
                socket.on('open', () => {
                    sockets.set(uuid, socket)
                })
                socket.on('close', () => {
                    sockets.delete(uuid)
                    resolve(callbackPromise)
                })
                socket.setSocket(req.socket, EMPTY_BUFFER, maximumIncomingMessageSize)
                req.socket.write(response)
                const callbackPromise = callback?.(uuid, socket)
            })
        }
        else {
            const {
                headers,
                status = 200,
                body
            } = state

            res.statusCode = status

            if (typeof body === 'string') {
                res.setHeader('Content-Type', 'text/html; charset=utf-8')
                res.setHeader('Content-Length', Buffer.byteLength(body, 'utf-8'))
                setResponseHeaders(res, headers)
                try {
                    await new Promise<void>((resolve, reject) => {
                        res.on('close', resolve)
                        res.on('error', reject)
                        res.end(body, 'utf-8')
                    })
                }
                catch (exception) {
                    exceptionListener(exception, req, state)
                }
            }
            else if (body instanceof Uint8Array) {
                res.setHeader('Content-Type', 'application/octet-stream')
                res.setHeader('Content-Length', body.byteLength)
                setResponseHeaders(res, headers)
                try {
                    await new Promise<void>((resolve, reject) => {
                        res.on('close', resolve)
                        res.on('error', reject)
                        res.end(body)
                    })
                }
                catch (exception) {
                    exceptionListener(exception, req, state)
                }
            }
            else if (body == null) {
                res.setHeader('Content-Length', 0)
                setResponseHeaders(res, headers)
                try {
                    await new Promise<void>((resolve, reject) => {
                        res.on('close', resolve)
                        res.on('error', reject)
                        res.end()
                    })
                }
                catch (exception) {
                    exceptionListener(exception, req, state)
                }
            }
            // stream
            else {
                res.setHeader('Content-Type', 'application/octet-stream')
                setResponseHeaders(res, headers)
                const iterable = typeof body === 'function' ? body() : body
                let readable: stream.Readable
                if (iterable instanceof stream.Readable) {
                    readable = iterable
                }
                else if (iterable instanceof ReadableStream) {
                    readable = (stream.Readable as any).fromWeb(iterable, { objectMode: false })
                }
                else {
                    readable = stream.Readable.from(iterable, { objectMode: false })
                }
                try {
                    await new Promise<void>((resolve, reject) => {
                        const errorHandler = (error: unknown): void => {
                            res.off('error', errorHandler)
                            readable.off('error', errorHandler)
                            readable.unpipe(res)
                            res.end()
                            reject(error)
                        }

                        res.on('close', resolve)
                        res.once('error', errorHandler)
                        readable.once('error', errorHandler)
                        readable.pipe(res)
                    })
                }
                catch (exception) {
                    exceptionListener(exception, req, state)
                }
            }
        }

        if (cleanup !== undefined) {
            await cleanup(state)
        }
    }

    return [ listener, sockets ]
}


/**
 * Returned from {@link parseMultipartRequest} when the `Content-Type` header
 * of the request is not a valid `multipart/form-data` content type with
 * boundary.
 */
export type InvalidMultipartContentTypeHeaderError = { tag: 'InvalidMultipartContentTypeHeader' }
/**
 * Returned from {@link parseMultipartRequest} if the request is aborted during
 * parsing.
 */
export type RequestAbortedError = { tag: 'RequestAborted' }
/**
 * Returned from {@link parseMultipartRequest} when any file is below the
 * {@link ParseMultipartRequestArguments.minimumFileSize minimumFileSize}
 * parameter in size.
 */
export type BelowMinimumFileSizeError = { tag: 'BelowMinimumFileSize' }
/**
 * Returned from {@link parseMultipartRequest} when the number of files exceeds
 * the {@link ParseMultipartRequestArguments.maximumFileCount maximumFileCount}
 * parameter.
 */
export type MaximumFileCountExceededError = { tag: 'MaximumFileCountExceeded' }
/**
 * Returned from {@link parseMultipartRequest} when any file exceeds the
 * the {@link ParseMultipartRequestArguments.maximumFileSize maximumFileSize}
 * parameter in size.
 */
export type MaximumFileSizeExceededError = { tag: 'MaximumFileSizeExceeded' }
/**
 * Returned from {@link parseMultipartRequest} when all files' combined exceed
 * the {@link ParseMultipartRequestArguments.maximumFileSize maximumFileSize}
 * and {@link ParseMultipartRequestArguments.maximumFileCount maximumFileCount}
 * parameters in size.
 */
export type MaximumTotalFileSizeExceededError = { tag: 'MaximumTotalFileSizeExceeded' }
/**
 * Returned from {@link parseMultipartRequest} when the number of fields
 * exceeds the {@link ParseMultipartRequestArguments.maximumFieldsCount maximumFieldsCount}
 * parameter.
 */
export type MaximumFieldsCountExceededError = { tag: 'MaximumFieldsCountExceeded' }
/**
 * Returned from {@link parseMultipartRequest} when all fields combined exceed
 * the {@link ParseMultipartRequestArguments.maximumFieldsSize maximumFieldsSize}
 * parameter in size.
 */
export type MaximumFieldsSizeExceededError = { tag: 'MaximumFieldsSizeExceeded' }
/**
 * Returned from {@link parseMultipartRequest} when an as of yet unknown error
 * occurs during parsing.
 */
export type UnknownParseError = { tag: 'UnknownError', error: unknown }
export type ParseMultipartRequestError =
    | InvalidMultipartContentTypeHeaderError
    | RequestAbortedError
    | BelowMinimumFileSizeError
    | MaximumFileCountExceededError
    | MaximumFileSizeExceededError
    | MaximumTotalFileSizeExceededError
    | MaximumFieldsCountExceededError
    | MaximumFieldsSizeExceededError
    | UnknownParseError

export type MultipartFile = {
    size: number
    /**
     * Path of the file on disk; where exactly this is will depend on the
     * `saveDirectory` parameter in the given
     * {@link ParseMultipartRequestArguments parse arguments}.
     */
    path: string
    mimetype: string
    dateModified: Date
}

export type ParsedMultipart = {
    fields: Record<string, string>
    files: Record<string, MultipartFile>
}

export type ParseMultipartRequestArguments = {
    /** Encoding of fields; defaults to `utf-8` */
    encoding?: BufferEncoding
    /** Defaults to the OS temp dir */
    saveDirectory?: string
    /** Defaults to false */
    keepFileExtensions?: boolean
    /**
     * The minimum size of each individual file in the body; if any file is
     * smaller in size, a {@link BelowMinimumFileSizeError} is returned.
     * By default unlimited.
     */
    minimumFileSize?: number
    /**
     * The maximum number of files in the body; if exceeded, a
     * {@link MaximumFileCountExceededError} is returned.
     * By default unlimited.
     */
    maximumFileCount?: number
    /**
     * The maximum size of each individual file in the body; if exceeded, a
     * {@link MaximumFileSizeExceededError} is returned.
     * By default unlimited.
     */
    maximumFileSize?: number
    /**
     * The maximum number of fields in the body; if exceeded, a
     * {@link MaximumFieldsCountExceededError} is returned.
     * By default unlimited.
     */
    maximumFieldsCount?: number
    /**
     * The maximum total size of fields in the body; if exceeded, a
     * {@link MaximumFieldsSizeExceededError} is returned.
     * By default unlimited.
     */
    maximumFieldsSize?: number
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
export function parseMultipartRequest(
    request: http.IncomingMessage,
    {
        encoding = 'utf-8',
        saveDirectory,
        keepFileExtensions = false,
        minimumFileSize = 0,
        maximumFileCount = Infinity,
        maximumFileSize = Infinity,
        maximumFieldsCount = Infinity,
        maximumFieldsSize = Infinity
    }: ParseMultipartRequestArguments = {}
): Promise<Result<ParsedMultipart, ParseMultipartRequestError>> {
    return new Promise(resolve => {
        new Formidable({
            enabledPlugins: [ 'multipart' ],
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
                return resolve(
                    error(
                        getMultipartError(exception)
                    )
                )
            }
            const newFiles: Record<string, MultipartFile> = {}
            for (const [ name, file ] of Object.entries(files)) {
                newFiles[name] = {
                    size: file.size,
                    path: file.filepath,
                    mimetype: file.mimetype,
                    dateModified: file.lastModifiedDate
                }
            }
            resolve(
                ok({
                    fields,
                    files: newFiles
                })
            )
        })
    })
}

function getMultipartError(error: unknown): ParseMultipartRequestError {
    if (!(error instanceof FormidableErrors.default)) {
        return { tag: 'UnknownError', error }
    }
    switch (error.code) {
        case FormidableErrors.malformedMultipart:
            return { tag: 'InvalidMultipartContentTypeHeader' }
        case FormidableErrors.aborted:
            return { tag: 'RequestAborted' }
        case FormidableErrors.maxFilesExceeded:
            return { tag: 'MaximumFileCountExceeded' }
        case FormidableErrors.biggerThanMaxFileSize:
            return { tag: 'MaximumFileSizeExceeded' }
        case FormidableErrors.biggerThanTotalMaxFileSize:
            return { tag: 'MaximumTotalFileSizeExceeded' }
        case FormidableErrors.maxFieldsExceeded:
            return { tag: 'MaximumFieldsCountExceeded' }
        case FormidableErrors.maxFieldsSizeExceeded:
            return { tag: 'MaximumFieldsSizeExceeded' }
        case FormidableErrors.smallerThanMinFileSize:
            return { tag: 'BelowMinimumFileSize' }
        default:
            return { tag: 'UnknownError', error }
    }
}


export type WebSocketHeaders = {
    upgrade?: string
    'sec-websocket-key'?: string
    'sec-websocket-version'?: string
    'sec-websocket-protocol'?: string
}

export type ParsedWebSocketHeaders = {
    /**
     * The string to be passed as the value of the response's
     * `Sec-WebSocket-Accept` header, created from the request's
     * `Sec-WebSocket-Key` header.
     */
    accept: string
    /**
     * The value of the request's `Sec-WebSocket-Protocol` header, to be
     * passed as the value of the response header with the same name.
     */
    protocol?: string
}

/** 
 * Returned by {@link parseWebSocketHeaders} when  the `Upgrade` header is 
 * missing. 
 */
export type MissingUpgradeHeaderError = { tag: 'MissingUpgradeHeader' }
/** 
 * Returned by {@link parseWebSocketHeaders} when the `Upgrade` header is not 
 * `websocket`. 
 */
export type InvalidUpgradeHeaderError = { tag: 'InvalidUpgradeHeader', header: string }
/** 
 * Returned by {@link parseWebSocketHeaders} when the `Sec-WebSocket-Key` 
 * header is not present. 
 */
export type MissingKeyHeaderError = { tag: 'MissingKeyHeader' }
/** 
 * Returned by {@link parseWebSocketHeaders} when the `Sec-WebSocket-Key` 
 * header is invalid. 
 */
export type InvalidKeyHeaderError = { tag: 'InvalidKeyHeader', header: string }
/** 
 * Returned by {@link parseWebSocketHeaders} when the `Sec-WebSocket-Version` 
 * header is missing. 
 */
export type MissingVersionHeaderError = { tag: 'MissingVersionHeader' }
/** 
 * Returned by {@link parseWebSocketHeaders} when the `Sec-WebSocket-Version` 
 * header is not `8` or `13`. 
 */
export type InvalidOrUnsupportedVersionHeaderError = {
    tag: 'InvalidOrUnsupportedVersionHeader'
    header: string
}
export type ParseWebSocketHeadersError =
    | MissingUpgradeHeaderError
    | InvalidUpgradeHeaderError
    | MissingKeyHeaderError
    | InvalidKeyHeaderError
    | MissingVersionHeaderError
    | InvalidOrUnsupportedVersionHeaderError

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
export function parseWebSocketHeaders(
    headers: WebSocketHeaders
): Result<ParsedWebSocketHeaders, ParseWebSocketHeadersError> {
    if (headers.upgrade === undefined) {
        return error<ParseWebSocketHeadersError>({ tag: 'MissingUpgradeHeader' })
    }
    if (headers.upgrade.toLowerCase() !== 'websocket') {
        return error<ParseWebSocketHeadersError>({
            tag: 'InvalidUpgradeHeader',
            header: headers.upgrade
        })
    }

    const key = headers['sec-websocket-key']
    if (key === undefined) {
        return error<ParseWebSocketHeadersError>({ tag: 'MissingKeyHeader' })
    }
    if (!/^[+/0-9a-z]{22}==$/i.test(key)) {
        return error<ParseWebSocketHeadersError>({
            tag: 'InvalidKeyHeader',
            header: key
        })
    }

    if (headers['sec-websocket-version'] === undefined) {
        return error<ParseWebSocketHeadersError>({ tag: 'MissingVersionHeader' })
    }
    // ws only supports 8 and 13
    if (!/^(?:8|13)$/.test(headers['sec-websocket-version'])) {
        return error<ParseWebSocketHeadersError>({
            tag: 'InvalidOrUnsupportedVersionHeader',
            header: headers['sec-websocket-version']
        })
    }

    const accept = createHash('sha1')
        .update(key + WEBSOCKET_GUID)
        .digest('base64')
    const protocol = headers['sec-websocket-protocol']
        ?.match(/^(.+?)(?:,|$)/)
        ?.[1]

    return ok({ accept, protocol })
}
