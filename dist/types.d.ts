/// <reference types="node" />
import type { IncomingMessage, RequestListener } from 'node:http';
import type WebSocket from 'ws';
import type { Awaitable } from 'fallible';
export type { IncomingMessage } from 'node:http';
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
export declare type AwaitableRequestListener = (..._: Parameters<RequestListener>) => Awaitable<ReturnType<RequestListener>>;
export declare type RequestListenerCleanup = () => Promise<Error | undefined>;
export declare type AwaitableIterable<T> = Iterable<T> | AsyncIterable<T>;
export declare type AwaitableIterator<Yield, Return = unknown, Next = unknown> = Iterator<Yield, Return, Next> | AsyncIterator<Yield, Return, Next>;
export declare type StreamBody = AwaitableIterable<Buffer> | (() => AwaitableIterable<Buffer>);
export declare type WebsocketMessageAction = {
    tag: 'Message';
    data: WebSocket.Data;
};
export declare type WebsocketBroadcastAction = {
    tag: 'Broadcast';
    data: WebSocket.Data;
    self: boolean;
};
export declare type WebsocketCloseAction = {
    tag: 'Close';
};
export declare type WebsocketIterator = AwaitableIterator<WebsocketMessageAction | WebsocketBroadcastAction, WebsocketCloseAction | void>;
export declare type WebsocketBroadcaster = (data: WebSocket.Data) => AsyncGenerator<Error | undefined, void>;
export declare type WebsocketOpenCallback = () => WebsocketIterator;
export declare type WebsocketMessageCallback = (data: WebSocket.Data) => WebsocketIterator;
export declare type WebsocketCloseCallback = (code: number, reason: string) => Awaitable<void>;
export declare type WebsocketSendErrorCallback = (data: WebSocket.Data, error: Error) => Awaitable<void>;
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
export declare type Cleanup = (message: IncomingMessage, state?: Readonly<Response>) => Awaitable<void>;
export declare type MessageHandlerResult<State = Response> = {
    state: State;
    cleanup?: Cleanup;
};
export declare type MessageHandler<ExistingState = void, NewState = Response> = (message: IncomingMessage, state: Readonly<ExistingState>, broadcast: WebsocketBroadcaster) => Awaitable<MessageHandlerResult<NewState>>;
export declare type ExceptionListener = (exception: unknown, message: IncomingMessage, state?: Readonly<Response>) => void;
