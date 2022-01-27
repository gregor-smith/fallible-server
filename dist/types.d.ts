/// <reference types="node" />
import type { IncomingMessage, RequestListener } from 'http';
import type { Data } from 'ws';
import type { Awaitable } from 'fallible';
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
export declare type RequestListenerCleanup = () => Promise<Error | undefined>;
export declare type AwaitableIterable<T> = Iterable<T> | AsyncIterable<T>;
export declare type AwaitableIterator<Yield, Return = unknown, Next = unknown> = Iterator<Yield, Return, Next> | AsyncIterator<Yield, Return, Next>;
export declare type StreamBody = AwaitableIterable<Buffer> | (() => AwaitableIterable<Buffer>);
export declare type WebsocketMessageAction = {
    tag: 'Message';
    data: Data;
};
export declare type WebsocketBroadcastAction = {
    tag: 'Broadcast';
    data: Data;
    self: boolean;
};
export declare type WebsocketCloseAction = {
    tag: 'Close';
};
export declare type WebsocketIterator = AwaitableIterator<WebsocketMessageAction | WebsocketBroadcastAction, WebsocketCloseAction | void>;
export declare type WebsocketBroadcaster = (data: Data) => AsyncGenerator<Error | undefined, void>;
export declare type WebsocketOpenCallback = () => WebsocketIterator;
export declare type WebsocketMessageCallback = (data: Data) => WebsocketIterator;
export declare type WebsocketCloseCallback = (code: number, reason: string) => Awaitable<void>;
export declare type WebsocketSendErrorCallback = (data: Data, error: Error) => Awaitable<void>;
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
