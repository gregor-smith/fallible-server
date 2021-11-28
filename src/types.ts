import type { IncomingMessage, RequestListener } from 'http'

import type { Data } from 'ws'
import type { Awaitable } from 'fallible'

import type { CloseWebSocket } from './general-utils.js'


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


export type AwaitableIterator<TYield = unknown, TReturn = unknown, TNext = unknown> =
    | Iterator<TYield, TReturn, TNext>
    | AsyncIterator<TYield, TReturn, TNext>


export type AwaitableIterable<T> =
    | Iterable<T>
    | AsyncIterable<T>


export type StreamBody =
    | AwaitableIterable<Buffer>
    | (() => AwaitableIterable<Buffer>)


export type WebsocketIterator = AwaitableIterator<Data, typeof CloseWebSocket | void, void>


export type WebsocketOpenCallback = () => WebsocketIterator
export type WebsocketMessageCallback = (message: Data) => WebsocketIterator
export type WebsocketCloseCallback = (code: number, reason: string) => Awaitable<void>
export type WebsocketSendErrorCallback = (message: Data, error: Error) => Awaitable<void>
export type WebsocketBody = {
    onOpen?: WebsocketOpenCallback
    onMessage: WebsocketMessageCallback
    onClose?: WebsocketCloseCallback
    onSendError?: WebsocketSendErrorCallback
}


export type Body =
    | string
    | Buffer
    | StreamBody
    | Readonly<WebsocketBody>


export type Header = Formattable | ReadonlyArray<Formattable>


export type Response = {
    cookies?: Readonly<Record<string, Readonly<Cookie>>>
    headers?: Readonly<Record<string, Header>>
    status?: number
    body?: Body
}


export type Cleanup = (
    message: IncomingMessage,
    state?: Readonly<Response>
) => Awaitable<void>


export type MessageHandlerResult<State = Response> = {
    state: State
    cleanup?: Cleanup
}


export type MessageHandler<ExistingState, NewState> = (
    message: IncomingMessage,
    state: Readonly<ExistingState>
) => Awaitable<MessageHandlerResult<NewState>>


export type ExceptionListener = (
    exception: unknown,
    message: IncomingMessage,
    state?: Readonly<Response>
) => void
