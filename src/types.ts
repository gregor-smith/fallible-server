import type { Readable } from 'stream'
import type { IncomingMessage, RequestListener } from 'http'

import type { Data } from 'ws'
import type { Awaitable, Result } from 'fallible'

import type { CloseWebSocket } from './general-utils'


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


export type AwaitableGenerator<TYield = unknown, TReturn = unknown, TNext = unknown> =
    | Generator<TYield, TReturn, TNext>
    | AsyncGenerator<TYield, TReturn, TNext>


export type WebsocketGenerator = AwaitableGenerator<Data, typeof CloseWebSocket | void, void>


export type WebsocketResponse = {
    onOpen?: () => WebsocketGenerator
    onClose?: (code: number, reason: string) => Awaitable<void>
    onError?: (error: Error) => Awaitable<void>
    onMessage: (message: Data) => WebsocketGenerator
    onSendError?: (message: Data, error: Error) => Awaitable<void>
}


export type Response = {
    cookies?: Readonly<Record<string, Readonly<Cookie>>>
    headers?: Readonly<Record<string, Formattable>>
    status?: number
    body?: string | Buffer | Readable | WebsocketResponse
}


export type Cleanup = (response?: Readonly<Response>) => Awaitable<void>


export type MessageHandlerResult<State> = {
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
