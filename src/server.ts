import type http from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import stream from 'node:stream'
import type { Socket } from 'node:net'

import WebSocket from 'ws'
import { Result, ok, error } from 'fallible'
import { Formidable, errors as FormidableErrors } from 'formidable'

import type * as types from './types.js'
import { response, WebSocketReadyState } from './utils.js'
import { WEBSOCKET_DEFAULT_MAXIMUM_MESSAGE_SIZE, WEBSOCKET_GUID } from './constants.js'


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
    socket: WebSocketWrapper,
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


class WebSocketWrapper implements types.IdentifiedWebSocket {
    #underlying: WebSocket
    #onSendError: types.WebSocketSendErrorCallback

    constructor(
        underlying: WebSocket,
        onSendError: types.WebSocketSendErrorCallback,
        readonly uuid: string
    ) {
        this.#underlying = underlying
        this.#onSendError = onSendError
    }

    get readyState(): WebSocketReadyState {
        return this.#underlying.readyState as WebSocketReadyState
    }

    async send(data: types.WebSocketData): Promise<void> {
        let error: Error | undefined
        try {
            error = await new Promise<Error | undefined>(resolve =>
                this.#underlying.send(data, resolve)
            )
        }
        catch (e) {
            if (!(e instanceof Error)) {
                throw e
            }
            error = e
        }
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


interface InternalWebSocket extends WebSocket {
    _protocol: string

    setSocket(socket: Socket, head: Buffer, maximumMessageSize: number): void
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
    const sockets = new Map<string, WebSocketWrapper>()

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
        if ('onOpen' in state) {
            const {
                onOpen,
                onMessage,
                onSendError = defaultOnWebsocketSendError,
                onClose,
                headers,
                protocol,
                maximumMessageSize = WEBSOCKET_DEFAULT_MAXIMUM_MESSAGE_SIZE,
                uuid = randomUUID()
            } = state

            const lines = [
                'HTTP/1.1 101 Switching Protocols',
                'Upgrade: websocket',
                'Connection: Upgrade',
            ]
            for (let [ header, value ] of Object.entries(headers)) {
                if (Array.isArray(value)) {
                    value = value.join(', ')
                }
                // TODO: sanitise headers, forbid upgrade/connection
                lines.push(`${header}: ${value}`)
            }
            lines.push('\r\n')
            const httpResponse = lines.join('\r\n')

            const ws = new WebSocket(null) as InternalWebSocket
            if (protocol !== undefined) {
                ws._protocol = protocol
            }
            const wrapper = new WebSocketWrapper(ws, onSendError, uuid)

            await new Promise<void>(resolve => {
                const closeListener = (code: number, reason: Buffer): void => {
                    sockets.delete(uuid)
                    ws.off('error', errorListener)
                    const result = ok({ code, reason })
                    const promise = onClose?.(result, uuid)
                    resolve(promise)
                }

                const errorListener = (exception: Error): void => {
                    sockets.delete(uuid)
                    ws.off('close', closeListener)
                    if (ws.readyState < WebSocketReadyState.Closing) {
                        ws.close()
                    }
                    exceptionListener(exception, req, state)
                    // TODO: type possible error codes
                    const result = error(exception)
                    const promise = onClose?.(result, uuid)
                    resolve(promise)
                }

                ws.on('open', () => {
                    sockets.set(uuid, wrapper)
                    sendWebSocketMessages(
                        wrapper,
                        onOpen(uuid)
                    )
                })
                ws.once('error', errorListener)
                ws.on('close', closeListener)
                if (onMessage !== undefined) {
                    ws.on('message', data => {
                        sendWebSocketMessages(
                            wrapper,
                            onMessage(data, uuid)
                        )
                    })
                }

                ws.setSocket(req.socket, Buffer.alloc(0), maximumMessageSize)
                req.socket.write(httpResponse)
            })
        }
        else {
            res.statusCode = state.status ?? 200
            const body = state.body

            if (typeof body === 'string') {
                res.setHeader('Content-Type', 'text/html; charset=utf-8')
                res.setHeader('Content-Length', Buffer.byteLength(body, 'utf-8'))
                setResponseHeaders(res, state.headers)
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
                setResponseHeaders(res, state.headers)
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
            else if (body === undefined) {
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
            // stream
            else {
                res.setHeader('Content-Type', 'application/octet-stream')
                setResponseHeaders(res, state.headers)
                const iterable = typeof body === 'function' ? body() : body
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


export type WebSocketResponderError =
    | { tag: 'NonGETMethod', method: string | undefined }
    | { tag: 'MissingUpgradeHeader' }
    | { tag: 'InvalidUpgradeHeader', header: string }
    | { tag: 'MissingKeyHeader' }
    | { tag: 'InvalidKeyHeader', header: string }
    | { tag: 'MissingVersionHeader' }
    | { tag: 'InvalidOrUnsupportedVersionHeader', header: string }

export type WebSocketResponderOptions = Omit<types.WebSocketResponse, 'protocol' | 'headers'> & {
    headers?: types.Headers
}


export class WebSocketResponder {
    private constructor(
        readonly accept: string,
        readonly protocol: string | undefined
    ) {}

    static fromHeaders(method: string | undefined, headers: types.WebSocketRequestHeaders): Result<WebSocketResponder, WebSocketResponderError> {
        if (method !== 'GET') {
            return error<WebSocketResponderError>({
                tag: 'NonGETMethod',
                method
            })
        }

        if (headers.upgrade === undefined) {
            return error<WebSocketResponderError>({ tag: 'MissingUpgradeHeader' })
        }
        if (headers.upgrade.toLowerCase() !== 'websocket') {
            return error<WebSocketResponderError>({
                tag: 'InvalidUpgradeHeader',
                header: headers.upgrade
            })
        }

        const key = headers['sec-websocket-key']
        if (key === undefined) {
            return error<WebSocketResponderError>({ tag: 'MissingKeyHeader' })
        }
        if (!/^[+/0-9a-z]{22}==$/i.test(key)) {
            return error<WebSocketResponderError>({
                tag: 'InvalidKeyHeader',
                header: key
            })
        }

        if (headers['sec-websocket-version'] === undefined) {
            return error<WebSocketResponderError>({ tag: 'MissingVersionHeader' })
        }
        // ws only supports 8 and 13
        if (!/^(?:8|13)$/.test(headers['sec-websocket-version'])) {
            return error<WebSocketResponderError>({
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
        const responder = new WebSocketResponder(accept, protocol)
        return ok(responder)
    }

    response(options: WebSocketResponderOptions, cleanup?: types.Cleanup): types.MessageHandlerResult<types.WebSocketResponse> {
        const headers: types.WebSocketResponseHeaders = {
            'Sec-WebSocket-Accept': this.accept
        }
        if (this.protocol !== undefined) {
            headers['Sec-WebSocket-Protocol'] = this.protocol
        }
        return response(
            {
                ...options,
                headers: { ...headers, ...options.headers },
                protocol: this.protocol
            },
            cleanup
        )
    }
}
