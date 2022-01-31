import type { IncomingMessage, RequestListener } from 'node:http'

import type WebSocket from 'ws'
import type { Awaitable } from 'fallible'

import type { CloseWebsocket, WebsocketReadyState } from './general-utils.js'


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


export type AwaitableIterable<T> =
    | Iterable<T>
    | AsyncIterable<T>


export type AwaitableIterator<Yield, Return = unknown, Next = unknown> =
    | Iterator<Yield, Return, Next>
    | AsyncIterator<Yield, Return, Next>


export type StreamBody =
    | AwaitableIterable<Buffer>
    | (() => AwaitableIterable<Buffer>)


export type WebsocketIterator = AwaitableIterator<WebSocket.Data, typeof CloseWebsocket | void>
export type WebsocketOpenCallback = (socketUUID: string) => WebsocketIterator
export type WebsocketMessageCallback = (data: WebSocket.Data, socketUUID: string) => WebsocketIterator
export type WebsocketCloseCallback = (code: number, reason: string, socketUUID: string) => Awaitable<void>
export type WebsocketSendErrorCallback = (data: WebSocket.Data, error: Error, socketUUID: string) => Awaitable<void>
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
    sockets: ReadonlyMap<string, IdentifiedWebsocket>,
    state: Readonly<ExistingState>
) => Awaitable<MessageHandlerResult<NewState>>


export type ExceptionListener = (
    exception: unknown,
    message: IncomingMessage,
    state?: Readonly<Response>
) => void


export interface IdentifiedWebsocket {
    readonly uuid: string
    readonly readyState: WebsocketReadyState

    send(data: WebSocket.Data): Promise<Error | undefined>
    close(code?: number, reason?: string): Promise<void>
}
