/// <reference types="node" />
import type { RequestListener, IncomingHttpHeaders } from 'http';
import type { Readable } from 'stream';
import { SetOption } from 'cookies';
import { Result, Awaitable } from 'fallible';
export declare type Method = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'TRACE' | 'OPTIONS' | 'CONNECT';
export declare type ParsedURL = {
    protocol: string;
    host: string;
    path: ReadonlyArray<string>;
    query: Readonly<Partial<Record<string, string>>>;
    hash: string;
};
export declare type ParsedContentType = {
    type: string;
    characterSet?: string;
};
export declare type RequestArguments = {
    getCookie: (key: string) => string | undefined;
    behindProxy: boolean;
    ip?: string;
    method: Method;
    headers: IncomingHttpHeaders;
    url: string;
};
export declare class Request {
    private readonly behindProxy;
    private readonly _ip?;
    private _parsedURL?;
    private _parsedContentType?;
    readonly cookie: (key: string) => string | undefined;
    readonly method: Method;
    readonly headers: Readonly<IncomingHttpHeaders>;
    readonly url: string;
    constructor({ getCookie, behindProxy, ip, method, headers, url }: RequestArguments);
    header(key: string): string | undefined;
    get parsedContentType(): Readonly<ParsedContentType> | undefined;
    get parsedURL(): Readonly<ParsedURL>;
    get protocol(): string;
    get host(): string;
    get path(): ReadonlyArray<string>;
    get query(): Readonly<Partial<Record<string, string>>>;
    get hash(): string;
    get contentLength(): number | undefined;
    get contentType(): string | undefined;
    get characterSet(): string | undefined;
    get ip(): string | undefined;
}
export declare type Cookie = Omit<SetOption, 'secureProxy'> & {
    value: string;
};
export declare type Response = {
    cookies?: Readonly<Record<string, Readonly<Cookie>>>;
    headers?: Readonly<Record<string, string | number>>;
    status?: number;
    body?: string | Buffer | Readable;
};
export declare type Cleanup<State, Errors> = (response: Readonly<Response>, state: Readonly<State>) => Awaitable<Result<void, Errors>>;
export declare type RequestHandlerResult<ExistingState, NewState, Errors> = {
    state: ExistingState & NewState;
    cleanup?: Cleanup<ExistingState & NewState, Errors>;
};
export declare type RequestHandler<ExistingState, NewState, Errors> = (request: Request, state: Readonly<ExistingState>) => Awaitable<Result<RequestHandlerResult<ExistingState, NewState, Errors>, Errors>>;
export declare type ResponseHandler<State, Errors> = (state: Readonly<State>) => Awaitable<Result<Response, Errors>>;
export declare type ErrorHandler<Errors> = (error: Readonly<Errors>) => Awaitable<Response>;
export declare type CreateRequestListenerArguments<State, Errors> = {
    secretKey: string;
    behindProxy?: boolean;
    requestHandler: RequestHandler<void, State, Errors>;
    responseHandler: ResponseHandler<State, Errors>;
    errorHandler: ErrorHandler<Errors>;
};
export declare function createRequestListener<State, Errors>({ secretKey, behindProxy, requestHandler, responseHandler, errorHandler }: CreateRequestListenerArguments<State, Errors>): RequestListener;
