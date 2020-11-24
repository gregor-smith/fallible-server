/// <reference types="node" />
import type { Readable } from 'stream';
import type { IncomingMessage } from 'http';
import type { Awaitable, Result } from 'fallible';
export declare type ParsedURLPath = {
    path: ReadonlyArray<string>;
    query: Readonly<Partial<Record<string, string>>>;
    hash: string;
};
export declare type ParsedContentType = {
    type: string;
    characterSet?: string;
};
export declare type Method = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'TRACE' | 'OPTIONS' | 'CONNECT';
export declare type Cookie = {
    value: string;
    maxAge?: number;
    path?: string;
    domain?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
};
export declare type Response = {
    cookies?: Readonly<Record<string, Readonly<Cookie>>>;
    headers?: Readonly<Record<string, string | number>>;
    status?: number;
    body?: string | Buffer | Readable;
};
export declare type Cleanup<Errors> = (response?: Readonly<Response>) => Awaitable<Result<void, Errors>>;
export declare type MessageHandlerResult<State, Errors> = {
    state: State;
    cleanup?: Cleanup<Errors>;
};
export declare type MessageHandler<ExistingState, NewState, Errors> = (message: IncomingMessage, state: Readonly<ExistingState>) => Awaitable<Result<MessageHandlerResult<ExistingState & NewState, Errors>, Errors>>;
export declare type ResponseHandler<State, Errors> = (state: Readonly<State>) => Awaitable<Result<Response, Errors>>;
export declare type ErrorHandler<Errors> = (error: Readonly<Errors>) => Awaitable<Response>;
