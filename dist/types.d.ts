/// <reference types="node" />
import type http from 'node:http';
import type WebSocket from 'ws';
import type { Awaitable } from 'fallible';
import type { WebSocketReadyState } from './general-utils.js';
/**
 * A Node {@link http.IncomingMessage IncomingMessage} that is correctly typed
 * to yield {@link Buffer Buffers} on iteration
 */
export declare type Message = Omit<http.IncomingMessage, typeof Symbol.asyncIterator> & AsyncIterable<Buffer>;
/** Data that can be sent in a WebSocket message */
export declare type WebsocketData = WebSocket.Data;
/** Value that can be formatted into a string as-is */
export declare type Formattable = string | number | boolean | bigint | null;
/**
 * A {@link http.RequestListener RequestListener} that can optionally return a
 * {@link PromiseLike}
 */
export declare type AwaitableRequestListener = (message: http.IncomingMessage, response: http.ServerResponse) => Awaitable<void>;
/** Iterable using `for await`  */
export declare type AwaitableIterable<T> = Iterable<T> | AsyncIterable<T>;
export declare type AwaitableIterator<Yield, Return = void, Next = unknown> = Iterator<Yield, Return, Next> | AsyncIterator<Yield, Return, Next>;
/**
 * @param code
 * For common close codes see https://datatracker.ietf.org/doc/html/rfc6455#section-7.4.1
 */
export declare type WebSocketCloseInfo = {
    code: number;
    reason?: string;
};
export declare type WebSocketIterator = AwaitableIterator<WebsocketData, WebSocketCloseInfo | void>;
export declare type WebSocketOpenCallback = (socketUUID: string) => WebSocketIterator;
export declare type WebSocketMessageCallback = (data: WebsocketData, socketUUID: string) => WebSocketIterator;
/**
 * @param code
 * For common close codes see https://datatracker.ietf.org/doc/html/rfc6455#section-7.4.1
 * @param reason
 * Will be an empty string if no close code was provided
 */
export declare type WebSocketCloseCallback = (code: number, reason: string, socketUUID: string) => Awaitable<void>;
export declare type WebSocketSendErrorCallback = (data: WebsocketData, error: Error, socketUUID: string) => Awaitable<void>;
export declare type WebSocketBody = {
    onOpen: WebSocketOpenCallback;
    onMessage?: WebSocketMessageCallback;
    onClose?: WebSocketCloseCallback;
    onSendError?: WebSocketSendErrorCallback;
};
export declare type Header = Formattable | ReadonlyArray<Formattable>;
/**
 * Any iterable—sync or async—yielding {@link Uint8Array Uint8Arrays}, or
 * a function returning such an iterable. Note that {@link Buffer Buffers} are
 * instances of {@link Uint8Array}, and Node streams implement
 * {@link AsyncIterable}
 */
export declare type StreamBody = AwaitableIterable<Uint8Array> | (() => AwaitableIterable<Uint8Array>);
export declare type RegularResponse = {
    headers?: Readonly<Record<string, Header>>;
    status?: number;
    body?: string | Uint8Array | StreamBody;
};
export declare type WebsocketResponse = {
    headers?: undefined;
    status?: 101;
    body: Readonly<WebSocketBody>;
};
export declare type Response = RegularResponse | WebsocketResponse;
export declare type Cleanup = (state: Readonly<Response>) => Awaitable<void>;
export declare type MessageHandlerResult<State = Response> = {
    state: State;
    cleanup?: Cleanup;
};
export declare type MessageHandler<ExistingState = void, NewState = Response> = (message: Message, state: Readonly<ExistingState>, sockets: SocketMap) => Awaitable<MessageHandlerResult<NewState>>;
export declare type ExceptionListener = (exception: unknown, message: Message, state?: Readonly<Response>) => void;
export interface IdentifiedWebSocket {
    readonly uuid: string;
    readonly readyState: WebSocketReadyState;
    send(data: WebsocketData): Promise<void>;
    close(code: number, reason?: string): Promise<void>;
}
export declare type SocketMap = ReadonlyMap<string, IdentifiedWebSocket>;
