/// <reference types="node" />
import type { IncomingMessage } from 'http';
import type Keygrip from 'keygrip';
import type { Cookie, Method, ParsedContentType } from './types';
export declare function parseMessageCookie(message: Pick<IncomingMessage, 'headers'>, name: string): string | undefined;
export declare function parseSignedMessageCookie(message: Pick<IncomingMessage, 'headers'>, name: string, keys: Pick<Keygrip, 'verify'>): string | undefined;
export declare function cookieHeader(name: string, { value, path, maxAge, domain, sameSite, secure, httpOnly }: Readonly<Cookie>): string;
export declare function signedCookieHeader(name: string, cookie: Readonly<Cookie>, keys: Pick<Keygrip, 'sign'>): string;
export declare function getMessageHeader(message: Pick<IncomingMessage, 'headers'>, name: string): string | undefined;
export interface IncomingMessageIPFields {
    headers: IncomingMessage['headers'];
    connection: Pick<IncomingMessage['connection'], 'remoteAddress'>;
    socket: Pick<IncomingMessage['socket'], 'remoteAddress'>;
}
export declare function getMessageIP(message: IncomingMessageIPFields, useXForwardedFor?: boolean): string | undefined;
export declare function getMessageMethod(message: Pick<IncomingMessage, 'method'>): Method;
export declare function getMessageURL(message: Pick<IncomingMessage, 'url'>): string;
export declare function parseURLQueryString(url: string, { skipEmptyValues, skipMissingValues }?: {
    skipEmptyValues?: boolean | undefined;
    skipMissingValues?: boolean | undefined;
}): Partial<Record<string, string>>;
export declare function parseURLHash(url: string): string;
export declare function parseURLPath(url: string): string[];
export declare function parseMessageContentType(message: Pick<IncomingMessage, 'headers'>): ParsedContentType | undefined;
export declare function parseMessageContentLength(message: Pick<IncomingMessage, 'headers'>): number | undefined;
