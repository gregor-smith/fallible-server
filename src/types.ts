import type { Readable } from 'stream'
import type { IncomingMessage } from 'http'

import type { Data } from 'ws'
import type { Awaitable, Result } from 'fallible'
import type { CloseWebSocket } from './utils'


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


export type Cookie = {
    value: string
    maxAge?: number
    path?: string
    domain?: string
    secure?: boolean
    httpOnly?: boolean
    sameSite?: 'strict' | 'lax' | 'none'
}


export type AwaitableGenerator<TYield = unknown, TReturn = unknown, TNext = unknown> =
    | Generator<TYield, TReturn, TNext>
    | AsyncGenerator<TYield, TReturn, TNext>


export type WebsocketResponse = {
    onOpen?: () => AwaitableGenerator<Data, typeof CloseWebSocket | void, void>
    onClose?: (code: number, reason: string) => Awaitable<void>
    onError?: (error: Error) => Awaitable<void>
    onMessage: (message: Data) => AwaitableGenerator<Data, typeof CloseWebSocket | void, void>
    onSendError?: (error: Error) => Awaitable<void>
}


export type Response = {
    cookies?: Readonly<Record<string, Readonly<Cookie>>>
    headers?: Readonly<Record<string, string | number | boolean>>
    status?: number
    body?: string | Buffer | Readable | WebsocketResponse
}


export type Cleanup<Errors> = () => Awaitable<Result<void, Errors>>


export type MessageHandlerResult<State, Errors> = {
    state: State
    cleanup?: Cleanup<Errors>
}


export type MessageHandler<ExistingState, NewState, Errors> = (
    message: IncomingMessage,
    state: Readonly<ExistingState>
) => Awaitable<Result<MessageHandlerResult<ExistingState & NewState, Errors>, Errors>>


export type ResponseHandler<State, Errors> = (
    state: Readonly<State>
) => Awaitable<Result<Response, Errors>>


export type ErrorHandler<Errors> = (
    error: Readonly<Errors>
) => Awaitable<Response>
