/// <reference types="node" />
import type { IncomingMessage, ServerResponse } from 'node:http';
import type WebSocket from 'ws';
import type { Awaitable } from 'fallible';
import type { CloseWebsocket, WebsocketReadyState } from './general-utils.js';
export declare type Message = Omit<IncomingMessage, typeof Symbol.asyncIterator> & AsyncIterable<Buffer>;
export declare type WebSocketData = WebSocket.Data;
export declare type ParsedContentType = {
    type: string;
    characterSet?: string;
};
export declare type Method = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'TRACE' | 'OPTIONS' | 'CONNECT';
export declare type Formattable = string | number | boolean | bigint | null;
export declare type Cookie = {
    value: Formattable;
    maxAge?: number;
    path?: string;
    domain?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
};
export declare type AwaitableRequestListener = (message: IncomingMessage, response: ServerResponse) => Awaitable<void>;
export declare type AwaitableIterable<T> = Iterable<T> | AsyncIterable<T>;
export declare type AwaitableIterator<Yield, Return = void, Next = unknown> = Iterator<Yield, Return, Next> | AsyncIterator<Yield, Return, Next>;
export declare type StreamBody = AwaitableIterable<Buffer> | (() => AwaitableIterable<Buffer>);
export declare type WebsocketIterator = AwaitableIterator<WebSocketData, typeof CloseWebsocket | void>;
export declare type WebsocketOpenCallback = (socketUUID: string) => WebsocketIterator;
export declare type WebsocketMessageCallback = (data: WebSocketData, socketUUID: string) => WebsocketIterator;
export declare type WebsocketCloseCallback = (code: number, reason: string, socketUUID: string) => Awaitable<void>;
export declare type WebsocketSendErrorCallback = (data: WebSocketData, error: Error, socketUUID: string) => Awaitable<void>;
export declare type WebsocketBody = {
    onOpen?: WebsocketOpenCallback;
    onMessage: WebsocketMessageCallback;
    onClose?: WebsocketCloseCallback;
    onSendError?: WebsocketSendErrorCallback;
};
export declare type Header = Formattable | ReadonlyArray<Formattable>;
export declare type RegularResponse = {
    cookies?: Readonly<Record<string, Readonly<Cookie>>>;
    headers?: Readonly<Record<string, Header>>;
    status?: number;
    body?: string | Buffer | StreamBody;
};
export declare type WebsocketResponse = {
    cookies?: undefined;
    headers?: undefined;
    status?: 101;
    body: Readonly<WebsocketBody>;
};
export declare type Response = RegularResponse | WebsocketResponse;
export declare type Cleanup = () => Awaitable<void>;
export declare type MessageHandlerResult<State = Response> = {
    state: State;
    cleanup?: Cleanup;
};
export declare type MessageHandler<ExistingState = void, NewState = Response> = (message: Message, sockets: ReadonlyMap<string, IdentifiedWebsocket>, state: Readonly<ExistingState>) => Awaitable<MessageHandlerResult<NewState>>;
export declare type ExceptionListener = (exception: unknown, message: Message, state?: Readonly<Response>) => void;
export interface IdentifiedWebsocket {
    readonly uuid: string;
    readonly readyState: WebsocketReadyState;
    send(data: WebSocketData): Promise<Error | undefined>;
    close(code?: number, reason?: string): Promise<void>;
}
