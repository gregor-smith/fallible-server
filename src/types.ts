import type { Readable } from 'stream'
import type { IncomingMessage } from 'http'

import type { Awaitable, Result } from 'fallible'


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


export type Response = {
    cookies?: Readonly<Record<string, Readonly<Cookie>>>
    headers?: Readonly<Record<string, string | number>>
    status?: number
    body?: string | Buffer | Readable
}


export type Cleanup<Errors> = (
    response?: Readonly<Response>
) => Awaitable<Result<void, Errors>>


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
