import type { IncomingMessage, RequestListener } from 'http'

import type { Data } from 'ws'
import type { Awaitable, Result } from 'fallible'

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


export type Formattable = string | number | boolean | bigint


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


export type WebsocketIterator = AwaitableIterator<Data, typeof CloseWebSocket | void, void>


export type WebsocketOpenCallback = () => WebsocketIterator
export type WebsocketMessageCallback = (message: Data) => WebsocketIterator
export type WebsocketCloseCallback = (code: number, reason: string) => Awaitable<void>
export type WebsocketSendErrorCallback = (message: Data, error: Error) => Awaitable<void>
export type WebsocketResponse = {
    onOpen?: WebsocketOpenCallback
    onMessage: WebsocketMessageCallback
    onClose?: WebsocketCloseCallback
    onSendError?: WebsocketSendErrorCallback
}


export interface Pipeable {
    pipe: (destination: NodeJS.WritableStream) => void
}


export type Body = string | Buffer | Pipeable | WebsocketResponse


export type Response = {
    cookies?: Readonly<Record<string, Readonly<Cookie>>>
    headers?: Readonly<Record<string, Formattable | ReadonlyArray<Formattable>>>
    status?: number
    body?: Body
}


export type Cleanup = (response?: Readonly<Response>) => Awaitable<void>


export type MessageHandlerResult<State = Response> = {
    state: State
    cleanup?: Cleanup
}


export type MessageHandler<ExistingState, NewState, Errors> = (
    message: IncomingMessage,
    state: Readonly<ExistingState>
) => Awaitable<Result<MessageHandlerResult<NewState>, Errors>>


export type ErrorHandler<Errors> = (
    error: Readonly<Errors>
) => Awaitable<Response>


export type ExceptionHandler = (
    exception: unknown
) => Awaitable<Response>
