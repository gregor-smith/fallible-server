/// <reference types="node" />
import type { IncomingMessage, RequestListener } from 'http';
import type { PipelineSource } from 'stream';
import type { Data } from 'ws';
import type { Awaitable, Result } from 'fallible';
import type { CloseWebSocket } from './general-utils.js';
export declare type ParsedContentType = {
    type: string;
    characterSet?: string;
};
export declare type Method = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'TRACE' | 'OPTIONS' | 'CONNECT';
export declare type Formattable = string | number | boolean | bigint;
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
export declare type WebsocketIterator = AwaitableIterator<Data, typeof CloseWebSocket | void, void>;
export declare type WebsocketOpenCallback = () => WebsocketIterator;
export declare type WebsocketMessageCallback = (message: Data) => WebsocketIterator;
export declare type WebsocketCloseCallback = (code: number, reason: string) => Awaitable<void>;
export declare type WebsocketSendErrorCallback = (message: Data, error: Error) => Awaitable<void>;
export declare type WebsocketResponse = {
    onOpen?: WebsocketOpenCallback;
    onMessage: WebsocketMessageCallback;
    onClose?: WebsocketCloseCallback;
    onSendError?: WebsocketSendErrorCallback;
};
export declare type Body = string | Buffer | PipelineSource<Buffer> | WebsocketResponse;
export declare type Response = {
    cookies?: Readonly<Record<string, Readonly<Cookie>>>;
    headers?: Readonly<Record<string, Formattable | ReadonlyArray<Formattable>>>;
    status?: number;
    body?: Body;
};
export declare type Cleanup = (response?: Readonly<Response>) => Awaitable<void>;
export declare type MessageHandlerResult<State = Response> = {
    state: State;
    cleanup?: Cleanup;
};
export declare type MessageHandler<ExistingState, NewState, Errors> = (message: IncomingMessage, state: Readonly<ExistingState>) => Awaitable<Result<MessageHandlerResult<NewState>, Errors>>;
export declare type ErrorHandler<Errors> = (error: Readonly<Errors>) => Awaitable<Response>;
export declare type ExceptionHandler = (exception: unknown) => Awaitable<Response>;
