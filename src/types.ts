import type { IncomingMessage, ServerResponse } from 'node:http'

import type WebSocket from 'ws'
import type { Awaitable } from 'fallible'

import type { CloseWebsocket, WebsocketReadyState } from './general-utils.js'


export type Message = Omit<IncomingMessage, typeof Symbol.asyncIterator> & AsyncIterable<Buffer>


export type WebSocketData = WebSocket.Data


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


export type AwaitableRequestListener = (
    message: IncomingMessage,
    response: ServerResponse
) => Awaitable<void>


export type AwaitableIterable<T> =
    | Iterable<T>
    | AsyncIterable<T>


export type AwaitableIterator<Yield, Return = void, Next = unknown> =
    | Iterator<Yield, Return, Next>
    | AsyncIterator<Yield, Return, Next>


export type StreamBody =
    | AwaitableIterable<Buffer>
    | (() => AwaitableIterable<Buffer>)


export type WebsocketIterator = AwaitableIterator<WebSocketData, typeof CloseWebsocket | void>
export type WebsocketOpenCallback = (socketUUID: string) => WebsocketIterator
export type WebsocketMessageCallback = (data: WebSocketData, socketUUID: string) => WebsocketIterator
export type WebsocketCloseCallback = (code: number, reason: string, socketUUID: string) => Awaitable<void>
export type WebsocketSendErrorCallback = (data: WebSocketData, error: Error, socketUUID: string) => Awaitable<void>
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
    body?: string | Uint8Array | StreamBody
}

export type WebsocketResponse = {
    cookies?: undefined
    headers?: undefined
    status?: 101
    body: Readonly<WebsocketBody>
}

export type Response = RegularResponse | WebsocketResponse


export type Cleanup = () => Awaitable<void>


export type MessageHandlerResult<State = Response> = {
    state: State
    cleanup?: Cleanup
}


export type MessageHandler<ExistingState = void, NewState = Response> = (
    message: Message,
    state: Readonly<ExistingState>,
    sockets: ReadonlyMap<string, IdentifiedWebsocket>
) => Awaitable<MessageHandlerResult<NewState>>


export type ExceptionListener = (
    exception: unknown,
    message: Message,
    state?: Readonly<Response>
) => void


export interface IdentifiedWebsocket {
    readonly uuid: string
    readonly readyState: WebsocketReadyState

    send(data: WebSocketData): Promise<Error | undefined>
    close(code?: number, reason?: string): Promise<void>
}
