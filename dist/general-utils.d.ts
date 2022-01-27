/// <reference types="node" />
import type { IncomingMessage } from 'http';
import type Keygrip from 'keygrip';
import { Result } from 'fallible';
import type { Data } from 'ws';
import type { Cleanup, Cookie, Formattable, MessageHandlerResult, Method, ParsedContentType, Response, WebsocketCloseAction, WebsocketBroadcastAction, WebsocketMessageAction } from './types.js';
export { parse as parseJSONString } from 'secure-json-parse';
export declare function parseCookieHeader(header: string, name: string): string | undefined;
export declare function parseMessageCookie(message: Pick<IncomingMessage, 'headers'>, name: string): string | undefined;
export declare function signatureCookieName<T extends Formattable>(name: T): `${T}.sig`;
export declare type ParseSignedMessageCookieError = 'ValueCookieMissing' | 'SignatureCookieMissing' | 'SignatureInvalid';
export declare type Keys = Pick<Keygrip, 'verify'>;
export declare function parseSignedMessageCookie(message: Pick<IncomingMessage, 'headers'>, name: string, keys: Keys): Result<string, ParseSignedMessageCookieError>;
export declare function cookieHeader(name: string, { value, path, maxAge, domain, sameSite, secure, httpOnly }: Cookie): string;
export declare function signedCookieHeader(name: string, cookie: Readonly<Cookie>, keys: Pick<Keygrip, 'sign'>): string;
export declare function getMessageHeader(message: Pick<IncomingMessage, 'headers'>, name: string): string | undefined;
export interface IncomingMessageIPFields {
    headers: IncomingMessage['headers'];
    socket: Pick<IncomingMessage['socket'], 'remoteAddress'>;
}
export declare function getMessageIP(message: IncomingMessageIPFields, useXForwardedFor?: boolean): string | undefined;
export declare function getMessageMethod(message: Pick<IncomingMessage, 'method'>): Method;
export declare function getMessageURL(message: Pick<IncomingMessage, 'url'>): string;
export declare function parseURLQueryString(url: string, { skipEmptyValues, skipMissingValues }?: {
    skipEmptyValues?: boolean | undefined;
    skipMissingValues?: boolean | undefined;
}): Record<string, string>;
export declare function joinURLQueryString(query: Record<string, string | number | bigint | boolean | null | undefined>): string;
export declare function parseURLHash(url: string): string;
export declare function parseURLPath(url: string): string;
export declare function parseURLPathSegments(url: string): string[];
export declare function parseContentTypeHeader(header: string): ParsedContentType | undefined;
export declare function parseMessageContentType(message: Pick<IncomingMessage, 'headers'>): ParsedContentType | undefined;
export declare function parseContentLengthHeader(header: string): number | undefined;
export declare function parseMessageContentLength(message: Pick<IncomingMessage, 'headers'>): number | undefined;
export declare function parseAuthorizationHeaderBearer(header: string): string | undefined;
export declare type ParseMessageAuthorisationBearerError = 'Missing' | 'Invalid';
export declare function parseMessageAuthorizationHeaderBearer(message: Pick<IncomingMessage, 'headers'>): Result<string, ParseMessageAuthorisationBearerError>;
export declare function messageIsWebSocketRequest(message: Pick<IncomingMessage, 'headers'>): boolean;
export declare function response(): MessageHandlerResult<Response>;
export declare function response<T>(state: T, cleanup?: Cleanup): MessageHandlerResult<T>;
export declare function message(data: Data): WebsocketMessageAction;
export declare function broadcast(data: Data, self?: boolean): WebsocketBroadcastAction;
export declare const close: WebsocketCloseAction;
export declare function iterateAsResolved<T>(promises: Iterable<PromiseLike<T>>): AsyncGenerator<T, void, unknown>;
