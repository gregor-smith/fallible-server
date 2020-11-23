/// <reference types="node" />
import type { RequestListener, IncomingHttpHeaders } from 'http';
import type { Readable } from 'stream';
import { SetOption } from 'cookies';
import { Result, Awaitable, Ok } from 'fallible';
export declare type ParsedURL = {
    path: ReadonlyArray<string>;
    query: Readonly<Partial<Record<string, string>>>;
    hash: string;
};
export declare type ParsedContentType = {
    type: string;
    characterSet?: string;
};
export declare type Method = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'TRACE' | 'OPTIONS' | 'CONNECT';
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
export declare type Cleanup<Errors> = (response?: Readonly<Response>) => Awaitable<Result<void, Errors>>;
export declare type RequestHandlerResult<State, Errors> = {
    state: State;
    cleanup?: Cleanup<Errors>;
};
export declare type RequestHandler<ExistingState, NewState, Errors> = (request: Request, state: Readonly<ExistingState>) => Awaitable<Result<RequestHandlerResult<ExistingState & NewState, Errors>, Errors>>;
export declare type ResponseHandler<State, Errors> = (state: Readonly<State>) => Awaitable<Result<Response, Errors>>;
export declare type ErrorHandler<Errors> = (error: Readonly<Errors>) => Awaitable<Response>;
export declare function defaultErrorHandler(): Response;
export declare function defaultResponseHandler(): Ok<Response>;
export declare type CreateRequestListenerArguments<State, Errors> = {
    secretKey: string;
    behindProxy?: boolean;
    requestHandler: RequestHandler<{}, State, Errors>;
    responseHandler?: ResponseHandler<State, Errors>;
    errorHandler?: ErrorHandler<Errors>;
};
export declare function createRequestListener<State, Errors>({ secretKey, behindProxy, requestHandler, responseHandler, errorHandler }: CreateRequestListenerArguments<State, Errors>): RequestListener;
export declare function composeRequestHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2>(handlers: [
    RequestHandler<ExistingState, NewState1, Errors1>,
    RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2>>) => Awaitable<Errors1 | Errors2>): RequestHandler<ExistingState, NewState1 & NewState2, Errors1 | Errors2>;
export declare function composeRequestHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2, NewState3, Errors3>(handlers: [
    RequestHandler<ExistingState, NewState1, Errors1>,
    RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    RequestHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3>>) => Awaitable<Errors1 | Errors2 | Errors3>): RequestHandler<ExistingState, NewState1 & NewState2 & NewState3, Errors1 | Errors2 | Errors3>;
export declare function composeRequestHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2, NewState3, Errors3, NewState4, Errors4>(handlers: [
    RequestHandler<ExistingState, NewState1, Errors1>,
    RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    RequestHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4>>) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4>): RequestHandler<ExistingState, NewState1 & NewState2 & NewState3 & NewState4, Errors1 | Errors2 | Errors3 | Errors4>;
export declare function composeRequestHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2, NewState3, Errors3, NewState4, Errors4, NewState5, Errors5>(handlers: [
    RequestHandler<ExistingState, NewState1, Errors1>,
    RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    RequestHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5>>) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5>): RequestHandler<ExistingState, NewState1 & NewState2 & NewState3 & NewState4 & NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>;
export declare function composeRequestHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2, NewState3, Errors3, NewState4, Errors4, NewState5, Errors5, NewState6, Errors6>(handlers: [
    RequestHandler<ExistingState, NewState1, Errors1>,
    RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    RequestHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>>) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>): RequestHandler<ExistingState, NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>;
export declare function composeRequestHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2, NewState3, Errors3, NewState4, Errors4, NewState5, Errors5, NewState6, Errors6, NewState7, Errors7>(handlers: [
    RequestHandler<ExistingState, NewState1, Errors1>,
    RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    RequestHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>>) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>): RequestHandler<ExistingState, NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>;
export declare function composeRequestHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2, NewState3, Errors3, NewState4, Errors4, NewState5, Errors5, NewState6, Errors6, NewState7, Errors7, NewState8, Errors8>(handlers: [
    RequestHandler<ExistingState, NewState1, Errors1>,
    RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    RequestHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7, NewState8, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>>) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>): RequestHandler<ExistingState, NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>;
export declare function composeRequestHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2, NewState3, Errors3, NewState4, Errors4, NewState5, Errors5, NewState6, Errors6, NewState7, Errors7, NewState8, Errors8, NewState9, Errors9>(handlers: [
    RequestHandler<ExistingState, NewState1, Errors1>,
    RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    RequestHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7, NewState8, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8, NewState9, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>>) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>): RequestHandler<ExistingState, NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8 & NewState9, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>;
export declare function composeRequestHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2, NewState3, Errors3, NewState4, Errors4, NewState5, Errors5, NewState6, Errors6, NewState7, Errors7, NewState8, Errors8, NewState9, Errors9, NewState10, Errors10>(handlers: [
    RequestHandler<ExistingState, NewState1, Errors1>,
    RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    RequestHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7, NewState8, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8, NewState9, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>,
    RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8 & NewState9, NewState10, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9 | Errors10>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9 | Errors10>>) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9 | Errors10>): RequestHandler<ExistingState, NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8 & NewState9 & NewState10, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9 | Errors10>;
