/// <reference types="node" />
import type http from 'node:http';
import { Result } from 'fallible';
import type * as types from './types.js';
/**
 * Creates a callback intended to be added as a listener to the `request` event
 * of an {@link http.Server}.
 * @param messageHandler
 * A function that takes an {@link http.IncomingMessage IncomingMessage} and
 * returns a {@link types.MessageHandlerResult MessageHandlerResult}. The
 * result may include a {@link types.Cleanup cleanup} function, which is always
 * called after the request has ended, regardless of whether any exceptions
 * occurred. The `Content-Type` header is set by default depending on type of
 * the {@link types.Response response} body: `string` bodies default to
 * `text/html; charset=utf8` while {@link Uint8Array} and
 * {@link types.StreamBody stream} bodies default to `application/octet-stream`.
 * The 'Content-Length' header is also set for all except stream and WebSocket
 * bodies.
 *
 * @param exceptionListener
 * A function called when the message handler throws or the
 * {@link http.ServerResponse ServerResponse} fires an `error` event. If not
 * given, a warning is printed and {@link console.error} is used.
 * @returns
 * The callback, and a map of all active WebSockets identified by UUIDs.
 */
export declare function createRequestListener(messageHandler: types.MessageHandler, exceptionListener?: types.ExceptionListener): [types.AwaitableRequestListener, types.SocketMap];
export declare type ParseMultipartRequestError = {
    tag: 'InvalidMultipartContentTypeHeader';
} | {
    tag: 'RequestAborted';
} | {
    tag: 'BelowMinimumFileSize';
} | {
    tag: 'MaximumFileCountExceeded';
} | {
    tag: 'MaximumFileSizeExceeded';
} | {
    tag: 'MaximumTotalFileSizeExceeded';
} | {
    tag: 'MaximumFieldsCountExceeded';
} | {
    tag: 'MaximumFieldsSizeExceeded';
} | {
    tag: 'UnknownError';
    error: unknown;
};
export declare type MultipartFile = {
    size: number;
    path: string;
    mimetype: string;
    dateModified: Date;
};
export declare type ParsedMultipart = {
    fields: Record<string, string>;
    files: Record<string, MultipartFile>;
};
export declare type ParseMultipartRequestArguments = {
    /** Encoding of fields; defaults to `utf-8` */
    encoding?: BufferEncoding;
    /** Defaults to the OS temp dir */
    saveDirectory?: string;
    /** Defaults to false */
    keepFileExtensions?: boolean;
    /**
     * The minimum size of each individual file in the body; if any file is
     * smaller in size, an {@link ParseMultipartRequestError error} is returned.
     * By default unlimited.
     */
    minimumFileSize?: number;
    /**
     * The maximum number of files in the body; if exceeded, an
     * {@link ParseMultipartRequestError error} is returned.
     * By default unlimited.
     */
    maximumFileCount?: number;
    /**
     * The maximum size of each individual file in the body; if exceeded, an
     * {@link ParseMultipartRequestError error} is returned.
     * By default unlimited.
     */
    maximumFileSize?: number;
    /**
     * The maximum number of fields in the body; if exceeded, an
     * {@link ParseMultipartRequestError error} is returned.
     * By default unlimited.
     */
    maximumFieldsCount?: number;
    /**
     * The maximum total size of fields in the body; if exceeded, an
     * {@link ParseMultipartRequestError error} is returned.
     * By default unlimited.
     */
    maximumFieldsSize?: number;
};
export declare function parseMultipartRequest(request: http.IncomingMessage, { encoding, saveDirectory, keepFileExtensions, minimumFileSize, maximumFileCount, maximumFileSize, maximumFieldsCount, maximumFieldsSize }?: ParseMultipartRequestArguments): Promise<Result<ParsedMultipart, ParseMultipartRequestError>>;
export declare type WebSocketResponderError = {
    tag: 'NonGETMethod';
    method: string | undefined;
} | {
    tag: 'MissingUpgradeHeader';
} | {
    tag: 'InvalidUpgradeHeader';
    header: string;
} | {
    tag: 'MissingKeyHeader';
} | {
    tag: 'InvalidKeyHeader';
    header: string;
} | {
    tag: 'MissingVersionHeader';
} | {
    tag: 'InvalidOrUnsupportedVersionHeader';
    header: string;
};
export declare type WebSocketResponderOptions = Omit<types.WebSocketResponse, 'protocol' | 'accept'>;
export declare class WebSocketResponder {
    readonly accept: string;
    readonly protocol: string | undefined;
    private constructor();
    static fromHeaders(method: string | undefined, headers: types.WebSocketRequestHeaders): Result<WebSocketResponder, WebSocketResponderError>;
    response(options: WebSocketResponderOptions, cleanup?: types.Cleanup): types.MessageHandlerResult<types.WebSocketResponse>;
}
