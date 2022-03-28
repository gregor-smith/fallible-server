import type { IncomingMessage, ServerResponse } from 'node:http'

import type WebSocket from 'ws'
import type { Awaitable } from 'fallible'

import type { WebsocketReadyState } from './general-utils.js'


export type Message = Omit<IncomingMessage, typeof Symbol.asyncIterator> & AsyncIterable<Buffer>


export type WebsocketData = WebSocket.Data


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


export type WebsocketCloseInfo = {
    code: number
    reason?: string
}
export type WebsocketIterator = AwaitableIterator<WebsocketData, WebsocketCloseInfo | void>
export type WebsocketOpenCallback = (socketUUID: string) => WebsocketIterator
export type WebsocketMessageCallback = (data: WebsocketData, socketUUID: string) => WebsocketIterator
export type WebsocketCloseCallback = (code: number, reason: string, socketUUID: string) => Awaitable<void>
export type WebsocketSendErrorCallback = (data: WebsocketData, error: Error, socketUUID: string) => Awaitable<void>
export type WebsocketBody = {
    onOpen: WebsocketOpenCallback
    onMessage?: WebsocketMessageCallback
    onClose?: WebsocketCloseCallback
    onSendError?: WebsocketSendErrorCallback
}


export type Header = Formattable | ReadonlyArray<Formattable>


export type StreamBody =
    | AwaitableIterable<Uint8Array>
    | (() => AwaitableIterable<Uint8Array>)


export type RegularResponse = {
    headers?: Readonly<Record<string, Header>>
    status?: number
    body?: string | Uint8Array | StreamBody
}

export type WebsocketResponse = {
    headers?: undefined
    status?: 101
    body: Readonly<WebsocketBody>
}

export type Response = RegularResponse | WebsocketResponse


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


export interface IdentifiedWebsocket {
    readonly uuid: string
    readonly readyState: WebsocketReadyState

    send(data: WebsocketData): Promise<void>
    close(code: number, reason?: string): Promise<void>
}

export type SocketMap = ReadonlyMap<string, IdentifiedWebsocket>
