import type http from 'node:http'

import type WebSocket from 'ws'
import type { Awaitable, Result } from 'fallible'

import type { WebSocketReadyState } from './utils.js'


/**
 * A Node {@link http.IncomingMessage IncomingMessage} that is correctly typed
 * to yield {@link Buffer Buffers} on iteration
 */
export type Message = Omit<http.IncomingMessage, typeof Symbol.asyncIterator> & AsyncIterable<Buffer>


/** Data that can be sent in a WebSocket message */
export type WebSocketData = WebSocket.Data

/** Value that can be formatted into a string as-is */
export type Formattable = string | number | boolean | bigint | null


/**
 * A {@link http.RequestListener RequestListener} that can optionally return a
 * {@link PromiseLike}
 */
// TODO: message/response types compatible with both ploin http module and
//       http2 module in compat mode
export type AwaitableRequestListener = (
    message: http.IncomingMessage,
    response: http.ServerResponse
) => Awaitable<void>


/** Iterable using `for await`  */
export type AwaitableIterable<T> =
    | Iterable<T>
    | AsyncIterable<T>

export type AwaitableIterator<Yield, Return = void, Next = unknown> =
    | Iterator<Yield, Return, Next>
    | AsyncIterator<Yield, Return, Next>


export type WebSocketCloseInfo = {
    /** For common close codes see https://datatracker.ietf.org/doc/html/rfc6455#section-7.4.1 */
    code: number
    reason?: string | Buffer
}
export type WebSocketIterator = AwaitableIterator<WebSocketData, WebSocketCloseInfo | void>
export type WebSocketOpenCallback = (socketUUID: string) => WebSocketIterator
export type WebSocketMessageCallback = (data: WebSocketData, socketUUID: string) => WebSocketIterator
/**
 * @param code
 * For common close codes see https://datatracker.ietf.org/doc/html/rfc6455#section-7.4.1
 * @param reason
 * Will be an empty string if no close code was provided
 */
export type WebSocketCloseCallback = (
    result: Result<{ code: number, reason: Buffer }, Error>,
    socketUUID: string
) => Awaitable<void>
export type WebSocketSendErrorCallback = (data: WebSocketData, error: Error, socketUUID: string) => Awaitable<void>

export type Header = Formattable | ReadonlyArray<Formattable>
export type Headers = Record<string, Header>


/**
 * Any iterable—sync or async—yielding {@link Uint8Array Uint8Arrays}, or
 * a function returning such an iterable. Note that {@link Buffer Buffers} are
 * instances of {@link Uint8Array}, and Node streams implement
 * {@link AsyncIterable}
 */
export type StreamBody =
    | AwaitableIterable<Uint8Array>
    | (() => AwaitableIterable<Uint8Array>)


export type RegularResponse = {
    /**
     * `Content-Length` and `Content-Type` headers may be set by default
     * depending on the type of `body`; see that field for details. Manually
     * specifying these headers will always override any defaults.
     */
    headers?: Headers
    /** Defaults to `200` */
    status?: number
    /**
     * The `Content-Type` and `Content-Length` headers may be set by default
     * depending on the type of this body:
     *
     * | Body type    | `Content-Type`             | `Content-Length`        |
     * |--------------|----------------------------|-------------------------|
     * | `string`     | `text/html; charset=utf-8` | Value's length in bytes |
     * | `Uint8Array` | `application/octet-stream` | Value's length in bytes |
     * | `StreamBody` | `application/octet-stream` | Not set                 |
     * | `undefined`  | Not set                    | `0`                     |
     *
     * Setting these headers through the `headers` field will always override
     * any defaults.
     */
    body?: string | Uint8Array | StreamBody
}

export type WebSocketRequestHeaders = Pick<
    http.IncomingHttpHeaders,
    | 'upgrade'
    | 'sec-websocket-key'
    | 'sec-websocket-version'
    | 'sec-websocket-protocol'
>

export type WebSocketResponseHeaders = Headers & {
    'Sec-WebSocket-Accept': string
}

export type WebSocketResponse = {
    onOpen: WebSocketOpenCallback
    onMessage?: WebSocketMessageCallback
    onClose?: WebSocketCloseCallback
    onSendError?: WebSocketSendErrorCallback
    maximumMessageSize?: number
    protocol?: string
    headers: WebSocketResponseHeaders
    uuid?: string
}

export type Response = RegularResponse | WebSocketResponse


export type Cleanup = (state: Readonly<Response>) => Awaitable<void>


export type MessageHandlerResult<State = Response> = {
    state: State
    cleanup?: Cleanup
}


export type MessageHandler<ExistingState = void, NewState = Response> = (
    message: Message,
    state: Readonly<ExistingState>,
    sockets: SocketMap
) => Awaitable<MessageHandlerResult<NewState>>


export type ExceptionListener = (
    exception: unknown,
    message: Message,
    state?: Readonly<Response>
) => void


export interface IdentifiedWebSocket {
    readonly uuid: string
    readonly readyState: WebSocketReadyState

    /**
     * Sends `data` and handles any errors that may occur using the
     * {@link WebSocketSendErrorCallback `onSendError`} callback provided when
     * the response was created.
     */
    send(data: WebSocketData): Promise<void>
    close(code: number, reason?: string | Buffer): Promise<void>
}

export type SocketMap = ReadonlyMap<string, IdentifiedWebSocket>
