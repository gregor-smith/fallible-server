/// <reference types="node" />
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import type { Cleanup, MessageHandlerResult, WebSocketBody, WebSocketResponse } from './types.js';
export { parse as parseJSONString } from 'secure-json-parse';
export declare const enum WebSocketReadyState {
    Connecting = 0,
    Open = 1,
    Closing = 2,
    Closed = 3
}
export interface IncomingMessageIPFields {
    headers: IncomingMessage['headers'];
    socket: Pick<IncomingMessage['socket'], 'remoteAddress'>;
}
/**
 * Attempts to return the IP of the client the message represents.
 *
 * @param useXForwardedFor
 * If `true`, the `'X-Forwarded-For'` header is respected. Defaults to `false`.
 */
export declare function getMessageIP(message: IncomingMessageIPFields, useXForwardedFor?: boolean): string | undefined;
export declare type ParsedContentType = {
    type: string;
    characterSet?: string;
};
/**
 * Parses the type and character set from a Content-Type header.
 * If the header has no `charset` directive, the entire header is returned.
 * Both type and characterSet are always returned lower case.
 */
export declare function parseCharSetContentTypeHeader(header: string): ParsedContentType | undefined;
/** Parses the integer value of a Content-Length header */
export declare function parseContentLengthHeader(header: string): number | undefined;
/** Parses the token from a Authorization header with the Bearer scheme */
export declare function parseAuthorizationHeaderBearer(header: string): string | undefined;
declare type WebSocketHeaders = Pick<IncomingHttpHeaders, 'connection' | 'upgrade' | 'sec-websocket-key' | 'sec-websocket-version'>;
/**
 * Returns whether all the headers required for a WebSocket upgrade are present.
 * Does not guarantee that those headers are fully valid - currently this can
 * only be confirmed by returning a {@link webSocketResponse} from a handler.
 */
export declare function headersIndicateWebSocketRequest(headers: WebSocketHeaders): boolean;
export declare function response<T extends void>(state?: T): MessageHandlerResult<T>;
export declare function response<T>(state: T, cleanup?: Cleanup): MessageHandlerResult<T>;
export declare function webSocketResponse(body: WebSocketBody, cleanup?: Cleanup): MessageHandlerResult<WebSocketResponse>;
/** Yields values from an iterable of promises as they resolve */
export declare function iterateAsResolved<T>(promises: Iterable<PromiseLike<T>>): AsyncGenerator<T, void, unknown>;
