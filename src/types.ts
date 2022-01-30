import type { IncomingMessage, RequestListener } from 'node:http'

import type WebSocket from 'ws'
import type { Awaitable } from 'fallible'


export type { IncomingMessage } from 'node:http'


export type ParsedContentType = {
    type: string
    characterSet?: string
}


export type Method =
    | 'GET'
    | 'HEAD'
    | 'POST'
    | 'PUT'
    | 'PATCH'
    | 'DELETE'
    | 'TRACE'
    | 'OPTIONS'
    | 'CONNECT'


export type Formattable = string | number | boolean | bigint | null


export type Cookie = {
    value: Formattable
    maxAge?: number
    path?: string
    domain?: string
    secure?: boolean
    httpOnly?: boolean
    sameSite?: 'strict' | 'lax' | 'none'
}


export type AwaitableRequestListener = (..._: Parameters<RequestListener>) =>
    Awaitable<ReturnType<RequestListener>>

export type RequestListenerCleanup = () => Promise<Error | undefined>


export type AwaitableIterable<T> =
    | Iterable<T>
    | AsyncIterable<T>


export type AwaitableIterator<Yield, Return = unknown, Next = unknown> =
    | Iterator<Yield, Return, Next>
    | AsyncIterator<Yield, Return, Next>


export type StreamBody =
    | AwaitableIterable<Buffer>
    | (() => AwaitableIterable<Buffer>)


export type WebsocketMessageAction = { tag: 'Message', data: WebSocket.Data }
export type WebsocketBroadcastAction = { tag: 'Broadcast', data: WebSocket.Data, self: boolean }
export type WebsocketCloseAction = { tag: 'Close' }

export type WebsocketIterator = AwaitableIterator<WebsocketMessageAction | WebsocketBroadcastAction, WebsocketCloseAction | void>

export type WebsocketBroadcaster = (data: WebSocket.Data) => AsyncGenerator<Error | undefined, void>

export type WebsocketOpenCallback = () => WebsocketIterator
export type WebsocketMessageCallback = (data: WebSocket.Data) => WebsocketIterator
export type WebsocketCloseCallback = (code: number, reason: string) => Awaitable<void>
export type WebsocketSendErrorCallback = (data: WebSocket.Data, error: Error) => Awaitable<void>
export type WebsocketBody = {
    onOpen?: WebsocketOpenCallback
    onMessage: WebsocketMessageCallback
    onClose?: WebsocketCloseCallback
    onSendError?: WebsocketSendErrorCallback
}


export type Header = Formattable | ReadonlyArray<Formattable>


export type RegularResponse = {
    cookies?: Readonly<Record<string, Readonly<Cookie>>>
    headers?: Readonly<Record<string, Header>>
    status?: number
    body?: string | Buffer | StreamBody
}

export type WebsocketResponse = {
    cookies?: undefined
    headers?: undefined
    status?: 101
    body: Readonly<WebsocketBody>
}

export type Response = RegularResponse | WebsocketResponse


export type Cleanup = (
    message: IncomingMessage,
    state?: Readonly<Response>
) => Awaitable<void>


export type MessageHandlerResult<State = Response> = {
    state: State
    cleanup?: Cleanup
}


export type MessageHandler<ExistingState = void, NewState = Response> = (
    message: IncomingMessage,
    state: Readonly<ExistingState>,
    broadcast: WebsocketBroadcaster
) => Awaitable<MessageHandlerResult<NewState>>


export type ExceptionListener = (
    exception: unknown,
    message: IncomingMessage,
    state?: Readonly<Response>
) => void
