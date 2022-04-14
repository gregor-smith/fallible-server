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


/**
 * A {@link http.RequestListener RequestListener} that can optionally return a
 * {@link PromiseLike}
 */
// TODO: message/response types compatible with both plain http module and
//       http2 module in compat mode
export type AwaitableRequestListener = (
    message: http.IncomingMessage,
    response: http.ServerResponse
) => Awaitable<void>


/** Any value iterable using `for await`  */
export type AwaitableIterable<T> =
    | Iterable<T>
    | AsyncIterable<T>

export type AwaitableIterator<Yield, Return = void, Next = unknown> =
    | Iterator<Yield, Return, Next>
    | AsyncIterator<Yield, Return, Next>


export type WebSocketCloseInfo = {
    /** For common close codes see https://datatracker.ietf.org/doc/html/rfc6455#section-7.4.1 */
    code: number
    /** Will be an empty string if no close code was provided */
    reason?: string | Buffer
}
export type WebSocketIterator = AwaitableIterator<WebSocketData, WebSocketCloseInfo | void>
export type WebSocketOpenCallback = (socketUUID: string) => WebSocketIterator
export type WebSocketMessageCallback = (data: WebSocketData, socketUUID: string) => WebSocketIterator
export type WebSocketCloseCallback = (
    result: Result<WebSocketCloseInfo, Error>,
    socketUUID: string
) => Awaitable<void>
export type WebSocketSendErrorCallback = (data: WebSocketData, error: Error, socketUUID: string) => Awaitable<void>


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
     * depending on the type of {@link RegularResponse.body `body`}; see that
     * field for details. Manually specifying these headers will always
     * override any defaults.
     */
    headers?: Headers
    /** Defaults to `200` */
    status?: number
    /**
     * The `Content-Type` and `Content-Length` headers may be set by default
     * depending on the type of this body:
     *
     * | Body type                       | `Content-Type`             | `Content-Length`        |
     * |---------------------------------|----------------------------|-------------------------|
     * | `string`                        | `text/html; charset=utf-8` | Value's length in bytes |
     * | `Uint8Array`                    | `application/octet-stream` | Value's length in bytes |
     * | {@link StreamBody `StreamBody`} | `application/octet-stream` | Not set                 |
     * | `undefined`                     | Not set                    | `0`                     |
     *
     * Setting these headers through the `headers` field will always override
     * any defaults.
     */
    body?: string | Uint8Array | StreamBody
}


export type WebSocketResponse = {
    /**
     * Used as the Sec-WebSocket-Accept header's value. Is typically the base64
     * representation of the SHA-1 hash of the incoming Sec-WebSocket-Key
     * header concatenated with a magic string. See:
     * https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers
     */
    accept: string
    /**
     * Used as the Sec-WebSocket-Protocol header's value. If the client
     * WebSocket gave a subprotocol during connection, it should be echoed as
     * this header. See:
     * https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers
     */
    protocol?: string
    /**
     * Incoming messages larger than this size will cause the socket to be
     * closed with a 1009 close code, and an error passed to
     * {@link WebSocketResponse.onClose `onClose`}.
     *
     * Outgoing messages larger than this size will be skipped and
     * {@link WebSocketResponse.onSendError `onSendError`} called.
     *
     * Defaults to `WEBSOCKET_DEFAULT_MAXIMUM_MESSAGE_SIZE`; see `./constants.ts`
     */
    maximumMessageSize?: number
    /**
     * The UUID used to identify the socket in the {@link SocketMap `SocketMap`}
     * and passed to the various callbacks. If not given, `crypto.randomUUID`
     * is used.
     */
    uuid?: string
    onOpen?: WebSocketOpenCallback
    onMessage?: WebSocketMessageCallback
    onClose?: WebSocketCloseCallback
    onSendError?: WebSocketSendErrorCallback
    /**
     * Additional headers. `Upgrade`, `Connection`, `Sec-WebSocket-Accept` and
     * `Sec-WebSocket-Protocol` headers should not be specified; doing so will
     * print a warning and their values will be ignored.
     */
    headers?: Headers
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
