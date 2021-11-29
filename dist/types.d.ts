/// <reference types="node" />
import type { IncomingMessage, RequestListener } from 'http';
import type { Data } from 'ws';
import type { Awaitable } from 'fallible';
import type { CloseWebSocket } from './general-utils.js';
export type { IncomingMessage } from 'http';
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
export declare type AwaitableIterator<TYield = unknown, TReturn = unknown, TNext = unknown> = Iterator<TYield, TReturn, TNext> | AsyncIterator<TYield, TReturn, TNext>;
export declare type AwaitableIterable<T> = Iterable<T> | AsyncIterable<T>;
export declare type StreamBody = AwaitableIterable<Buffer> | (() => AwaitableIterable<Buffer>);
export declare type WebsocketIterator = AwaitableIterator<Data, typeof CloseWebSocket | void, void>;
export declare type WebsocketOpenCallback = () => WebsocketIterator;
export declare type WebsocketMessageCallback = (message: Data) => WebsocketIterator;
export declare type WebsocketCloseCallback = (code: number, reason: string) => Awaitable<void>;
export declare type WebsocketSendErrorCallback = (message: Data, error: Error) => Awaitable<void>;
export declare type WebsocketBody = {
    onOpen?: WebsocketOpenCallback;
    onMessage: WebsocketMessageCallback;
    onClose?: WebsocketCloseCallback;
    onSendError?: WebsocketSendErrorCallback;
};
export declare type Body = string | Buffer | StreamBody | Readonly<WebsocketBody>;
export declare type Header = Formattable | ReadonlyArray<Formattable>;
export declare type Response = {
    cookies?: Readonly<Record<string, Readonly<Cookie>>>;
    headers?: Readonly<Record<string, Header>>;
    status?: number;
    body?: Body;
};
export declare type Cleanup = (message: IncomingMessage, state?: Readonly<Response>) => Awaitable<void>;
export declare type MessageHandlerResult<State = Response> = {
    state: State;
    cleanup?: Cleanup;
};
export declare type MessageHandler<ExistingState = void, NewState = Response> = (message: IncomingMessage, state: Readonly<ExistingState>) => Awaitable<MessageHandlerResult<NewState>>;
export declare type ExceptionListener = (exception: unknown, message: IncomingMessage, state?: Readonly<Response>) => void;
