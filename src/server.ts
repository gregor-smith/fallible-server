import type http from 'node:http'
import { randomUUID } from 'node:crypto'
import stream from 'node:stream'

import WebSocket from 'ws'
import { Result, ok, error } from 'fallible'
import { Formidable, errors as FormidableErrors } from 'formidable'

import type * as types from './types.js'
import { WebSocketReadyState } from './utils.js'


function warn(message: string): void {
    console.warn(`fallible-server: ${message}`)
}


function defaultOnWebsocketSendError(
    _data: types.WebSocketData,
    { name, message }: Error
): void {
    warn("Unknown error sending Websocket message. Consider adding an 'onSendError' callback to your response")
    warn(name)
    warn(message)
}


function setResponseHeaders(
    res: http.ServerResponse,
    headers: Record<string, types.Header> | undefined
): void {
    if (headers !== undefined) {
        for (const [ name, value ] of Object.entries(headers)) {
            const header = Array.isArray(value) ? value.map(String) : String(value)
            res.setHeader(name, header)
        }
    }
}


async function sendWebSocketMessages(
    socket: Socket,
    messages: types.WebSocketIterator
): Promise<void> {
    const promises: Promise<void>[] = []

    while (true) {
        const result = await messages.next()

        if (socket.readyState !== WebSocketReadyState.Open) {
            await Promise.all(promises)
            return
        }

        if (result.done) {
            await Promise.all(promises)
            if (result.value === undefined) {
                return
            }
            return socket.close(result.value.code, result.value.reason)
        }

        const promise = socket.send(result.value)
        promises.push(promise)
    }
}


function getDefaultExceptionListener(): types.ExceptionListener {
    warn("default exception listener will be used. Consider overriding via the 'exceptionListener' option")
    return console.error
}


class Socket implements types.IdentifiedWebSocket {
    #underlying: WebSocket
    #onSendError: types.WebSocketSendErrorCallback

    readonly uuid = randomUUID()

    constructor(
        underlying: WebSocket,
        onSendError: types.WebSocketSendErrorCallback
    ) {
        this.#underlying = underlying
        this.#onSendError = onSendError
    }

    get readyState(): WebSocketReadyState {
        return this.#underlying.readyState as WebSocketReadyState
    }

    async send(data: types.WebSocketData): Promise<void> {
        const error = await new Promise<Error | undefined>(resolve =>
            this.#underlying.send(data, resolve)
        )
        if (error !== undefined) {
            await this.#onSendError(data, error, this.uuid)
        }
    }

    close(code?: number, reason?: string | Buffer): Promise<void> {
        return new Promise(resolve => {
            this.#underlying.on('close', resolve)
            this.#underlying.close(code, reason)
        })
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
export function createRequestListener(
    messageHandler: types.MessageHandler,
    exceptionListener = getDefaultExceptionListener()
): [ types.AwaitableRequestListener, types.SocketMap ] {
    const server = new WebSocket.Server({ noServer: true })
    const sockets = new Map<string, Socket>()

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

        res.statusCode = state.status ?? 200

        if (typeof state.body === 'string') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.setHeader('Content-Length', Buffer.byteLength(state.body, 'utf-8'))
            setResponseHeaders(res, state.headers)
            try {
                await new Promise<void>((resolve, reject) => {
                    res.on('close', resolve)
                    res.on('error', reject)
                    res.end(state.body, 'utf-8')
                })
            }
            catch (exception) {
                exceptionListener(exception, req, state)
            }
        }
        else if (state.body instanceof Uint8Array) {
            res.setHeader('Content-Type', 'application/octet-stream')
            res.setHeader('Content-Length', state.body.byteLength)
            setResponseHeaders(res, state.headers)
            try {
                await new Promise<void>((resolve, reject) => {
                    res.on('close', resolve)
                    res.on('error', reject)
                    res.end(state.body)
                })
            }
            catch (exception) {
                exceptionListener(exception, req, state)
            }
        }
        // no body
        else if (state.body === undefined) {
            res.setHeader('Content-Length', 0)
            setResponseHeaders(res, state.headers)
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
        // websocket
        else if ('onOpen' in state.body) {
            // TODO: subclass WebSocket.Server and override the handleUpgrade
            // implementation with one that throws rather than ending the socket
            const websocket = await new Promise<WebSocket>(resolve =>
                server.handleUpgrade(
                    req,
                    req.socket,
                    Buffer.alloc(0),
                    resolve
                )
            )

            const { onOpen, onMessage, onSendError, onClose } = state.body

            const socket = new Socket(
                websocket,
                onSendError ?? defaultOnWebsocketSendError
            )
            sockets.set(socket.uuid, socket)

            if (onMessage !== undefined) {
                websocket.on('message', data =>
                    sendWebSocketMessages(
                        socket,
                        onMessage(data, socket.uuid)
                    )
                )
            }

            // no need to listen for the socket error event as close event is
            // always called on errors anyway. see:
            // https://github.com/websockets/ws/issues/1823#issuecomment-740056036

            const [ closeReason, ] = await Promise.all([
                new Promise<[ number, string | Buffer ]>(resolve =>
                    websocket.on('close', (...args) => resolve(args))
                ),
                // the 'open' even is never fired when running in noServer
                // mode, so just call onOpen straight away as the request
                // is already opened
                sendWebSocketMessages(
                    socket,
                    onOpen(socket.uuid)
                )
            ])

            // TODO: keep track of sendWebSocketMessages promises and await here

            sockets.delete(socket.uuid)

            if (onClose !== undefined) {
                await onClose(...closeReason, socket.uuid)
            }
        }
        // iterable
        else {
            res.setHeader('Content-Type', 'application/octet-stream')
            setResponseHeaders(res, state.headers)
            const iterable = typeof state.body === 'function'
                ? state.body()
                : state.body
            const readable = iterable instanceof stream.Readable
                ? iterable
                : stream.Readable.from(iterable, { objectMode: false })
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

        if (cleanup !== undefined) {
            await cleanup(state)
        }
    }

    return [ listener, sockets ]
}


export type ParseMultipartRequestError =
    | { tag: 'InvalidMultipartContentTypeHeader' }
    | { tag: 'RequestAborted' }
    | { tag: 'BelowMinimumFileSize' }
    | { tag: 'MaximumFileCountExceeded' }
    | { tag: 'MaximumFileSizeExceeded' }
    | { tag: 'MaximumTotalFileSizeExceeded' }
    | { tag: 'MaximumFieldsCountExceeded' }
    | { tag: 'MaximumFieldsSizeExceeded' }
    | { tag: 'UnknownError', error: unknown }

export type MultipartFile = {
    size: number
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
     * smaller in size, an {@link ParseMultipartRequestError error} is returned.
     * By default unlimited.
     */
    minimumFileSize?: number
    /**
     * The maximum number of files in the body; if exceeded, an
     * {@link ParseMultipartRequestError error} is returned.
     * By default unlimited.
     */
    maximumFileCount?: number
    /**
     * The maximum size of each individual file in the body; if exceeded, an
     * {@link ParseMultipartRequestError error} is returned.
     * By default unlimited.
     */
    maximumFileSize?: number
    /**
     * The maximum number of fields in the body; if exceeded, an
     * {@link ParseMultipartRequestError error} is returned.
     * By default unlimited.
     */
    maximumFieldsCount?: number
    /**
     * The maximum total size of fields in the body; if exceeded, an
     * {@link ParseMultipartRequestError error} is returned.
     * By default unlimited.
     */
    maximumFieldsSize?: number
}

// TODO: replace with async generator
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
