/// <reference types="node" />
import type http from 'node:http';
import { Result } from 'fallible';
import type * as types from './types.js';
/**
 * Creates a callback intended to be added as a listener to the `request` event
 * of an {@link http.Server}.
 * @param messageHandler
 * A function that takes an {@link http.IncomingMessage IncomingMessage} and
 * returns a {@link types.MessageHandlerResult MessageHandlerResult<Response>}.
 * The result may include a {@link types.Cleanup cleanup} function, which is
 * always called after the request has ended, regardless of whether any
 * exceptions occurred.
 * See {@link types.RegularResponse RegularResponse} and
 * {@link types.WebSocketResponse WebSocketResponse} for details about
 * responses that can be returned.
 *
 * @param exceptionListener
 * A function called when the message handler throws or the
 * {@link http.ServerResponse ServerResponse} fires an `error` event. If not
 * given, a warning is printed and {@link console.error} is used.
 * @returns
 * The callback, and a map of all active WebSockets identified by UUIDs.
 */
export declare function createRequestListener(messageHandler: types.MessageHandler, exceptionListener?: types.ExceptionListener): [types.AwaitableRequestListener, types.SocketMap];
/**
 * Returned from {@link parseMultipartRequest} when the `Content-Type` header
 * of the request is not a valid `multipart/form-data` content type with
 * boundary.
 */
export declare type InvalidMultipartContentTypeHeaderError = {
    tag: 'InvalidMultipartContentTypeHeader';
};
/**
 * Returned from {@link parseMultipartRequest} if the request is aborted during
 * parsing.
 */
export declare type RequestAbortedError = {
    tag: 'RequestAborted';
};
/**
 * Returned from {@link parseMultipartRequest} when any file is below the
 * {@link ParseMultipartRequestArguments.minimumFileSize minimumFileSize}
 * parameter in size.
 */
export declare type BelowMinimumFileSizeError = {
    tag: 'BelowMinimumFileSize';
};
/**
 * Returned from {@link parseMultipartRequest} when the number of files exceeds
 * the {@link ParseMultipartRequestArguments.maximumFileCount maximumFileCount}
 * parameter.
 */
export declare type MaximumFileCountExceededError = {
    tag: 'MaximumFileCountExceeded';
};
/**
 * Returned from {@link parseMultipartRequest} when any file exceeds the
 * the {@link ParseMultipartRequestArguments.maximumFileSize maximumFileSize}
 * parameter in size.
 */
export declare type MaximumFileSizeExceededError = {
    tag: 'MaximumFileSizeExceeded';
};
/**
 * Returned from {@link parseMultipartRequest} when all files' combined exceed
 * the {@link ParseMultipartRequestArguments.maximumFileSize maximumFileSize}
 * and {@link ParseMultipartRequestArguments.maximumFileCount maximumFileCount}
 * parameters in size.
 */
export declare type MaximumTotalFileSizeExceededError = {
    tag: 'MaximumTotalFileSizeExceeded';
};
/**
 * Returned from {@link parseMultipartRequest} when the number of fields
 * exceeds the {@link ParseMultipartRequestArguments.maximumFieldsCount maximumFieldsCount}
 * parameter.
 */
export declare type MaximumFieldsCountExceededError = {
    tag: 'MaximumFieldsCountExceeded';
};
/**
 * Returned from {@link parseMultipartRequest} when all fields combined exceed
 * the {@link ParseMultipartRequestArguments.maximumFieldsSize maximumFieldsSize}
 * parameter in size.
 */
export declare type MaximumFieldsSizeExceededError = {
    tag: 'MaximumFieldsSizeExceeded';
};
/**
 * Returned from {@link parseMultipartRequest} when an as of yet unknown error
 * occurs during parsing.
 */
export declare type UnknownParseError = {
    tag: 'UnknownError';
    error: unknown;
};
export declare type ParseMultipartRequestError = InvalidMultipartContentTypeHeaderError | RequestAbortedError | BelowMinimumFileSizeError | MaximumFileCountExceededError | MaximumFileSizeExceededError | MaximumTotalFileSizeExceededError | MaximumFieldsCountExceededError | MaximumFieldsSizeExceededError | UnknownParseError;
export declare type MultipartFile = {
    size: number;
    /**
     * Path of the file on disk; where exactly this is will depend on the
     * `saveDirectory` parameter in the given
     * {@link ParseMultipartRequestArguments parse arguments}.
     */
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
     * smaller in size, a {@link BelowMinimumFileSizeError} is returned.
     * By default unlimited.
     */
    minimumFileSize?: number;
    /**
     * The maximum number of files in the body; if exceeded, a
     * {@link MaximumFileCountExceededError} is returned.
     * By default unlimited.
     */
    maximumFileCount?: number;
    /**
     * The maximum size of each individual file in the body; if exceeded, a
     * {@link MaximumFileSizeExceededError} is returned.
     * By default unlimited.
     */
    maximumFileSize?: number;
    /**
     * The maximum number of fields in the body; if exceeded, a
     * {@link MaximumFieldsCountExceededError} is returned.
     * By default unlimited.
     */
    maximumFieldsCount?: number;
    /**
     * The maximum total size of fields in the body; if exceeded, a
     * {@link MaximumFieldsSizeExceededError} is returned.
     * By default unlimited.
     */
    maximumFieldsSize?: number;
};
/**
 * Parses a request's `multipart/form-data` body and returns a record of files
 * and fields. Files are saved to the disk. Various limits on file and field
 * sizes and counts can be configured; see
 * {@link ParseMultipartRequestArguments}.
 *
 * Returns {@link InvalidMultipartContentTypeHeaderError} if the `Content-Type`
 * header of the request is not a valid `multipart/form-data` content type with
 * boundary.
 * Returns {@link RequestAbortedError} if the request is aborted during parsing.
 * Returns {@link BelowMinimumFileSizeError} when any file is below the
 * {@link ParseMultipartRequestArguments.minimumFileSize minimumFileSize}
 * parameter in size.
 * Returns {@link MaximumFileCountExceededError} when the number of files
 * exceeds the {@link ParseMultipartRequestArguments.maximumFileCount maximumFileCount}
 * parameter.
 * Returns {@link MaximumFileSizeExceededError} when any file exceeds the the
 * {@link ParseMultipartRequestArguments.maximumFileSize maximumFileSize}
 * parameter in size.
 * Returns {@link MaximumTotalFileSizeExceededError} when all files' combined
 * exceed the {@link ParseMultipartRequestArguments.maximumFileSize maximumFileSize} and
 * {@link ParseMultipartRequestArguments.maximumFileCount maximumFileCount}
 * parameters in size.
 * Returns {@link MaximumFieldsCountExceededError} when the number of fields
 * exceeds the {@link ParseMultipartRequestArguments.maximumFieldsCount maximumFieldsCount}
 * parameter.
 * Returns {@link MaximumFieldsSizeExceededError} when all fields combined
 * exceed the {@link ParseMultipartRequestArguments.maximumFieldsSize maximumFieldsSize}
 * parameter in size.
 * Returns {@link UnknownParseError} when an as of yet unknown error
 * occurs during parsing.
 */
export declare function parseMultipartRequest(request: http.IncomingMessage, { encoding, saveDirectory, keepFileExtensions, minimumFileSize, maximumFileCount, maximumFileSize, maximumFieldsCount, maximumFieldsSize }?: ParseMultipartRequestArguments): Promise<Result<ParsedMultipart, ParseMultipartRequestError>>;
/**
 * Returned from {@link WebSocketResponder.fromHeaders} when the `method` is
 * not `GET`.
 */
export declare type NonGETMethodError = {
    tag: 'NonGETMethod';
    method: string | undefined;
};
/**
 * Returned from {@link WebSocketResponder.fromHeaders} when the `Upgrade`
 * header is not present.
 */
export declare type MissingUpgradeHeaderError = {
    tag: 'MissingUpgradeHeader';
};
/**
 * Returned from {@link WebSocketResponder.fromHeaders} when the `Upgrade`
 * header is not `websocket`.
 */
export declare type InvalidUpgradeHeaderError = {
    tag: 'InvalidUpgradeHeader';
    header: string;
};
/**
 * Returned from {@link WebSocketResponder.fromHeaders} when the
 * `Sec-WebSocket-Key` header is not present.
 */
export declare type MissingKeyHeaderError = {
    tag: 'MissingKeyHeader';
};
/**
 * Returned from {@link WebSocketResponder.fromHeaders} when the
 * `Sec-WebSocket-Key` header is invalid.
 */
export declare type InvalidKeyHeaderError = {
    tag: 'InvalidKeyHeader';
    header: string;
};
/**
 * Returned from {@link WebSocketResponder.fromHeaders} when the
 * `Sec-WebSocket-Version` header is missing.
 */
export declare type MissingVersionHeaderError = {
    tag: 'MissingVersionHeader';
};
/**
 * Returned from {@link WebSocketResponder.fromHeaders} when the
 * `Sec-WebSocket-Version` header is not `8` or `13`.
 */
export declare type InvalidOrUnsupportedVersionHeaderError = {
    tag: 'InvalidOrUnsupportedVersionHeader';
    header: string;
};
export declare type WebSocketResponderError = NonGETMethodError | MissingUpgradeHeaderError | InvalidUpgradeHeaderError | MissingKeyHeaderError | InvalidKeyHeaderError | MissingVersionHeaderError | InvalidOrUnsupportedVersionHeaderError;
/**
 * A {@link types.WebSocketResponse WebSocketResponse} excluding the `protocol`
 * and `accept` fields.
 */
export declare type WebSocketResponderOptions = Omit<types.WebSocketResponse, 'protocol' | 'accept'>;
/** A helper class for making WebSocket responses. */
export declare class WebSocketResponder {
    /**
     * The string to be passed as the value of the response's
     * `Sec-WebSocket-Accept` header, created from the request's
     * `Sec-WebSocket-Key` header.
     */
    readonly accept: string;
    /**
     * The value of the request's `Sec-WebSocket-Protocol` header, to be
     * passed as the value of the response header with the same name.
     */
    readonly protocol: string | undefined;
    private constructor();
    /**
     * Creates a new {@link WebSocketResponder} from a request's headers and
     * method.
     *
     * Returns {@link NonGETMethodError} if the method is not `GET`.
     * Returns {@link MissingUpgradeHeaderError} if the `Upgrade` header is
     * missing.
     * Returns {@link InvalidUpgradeHeaderError} if the `Upgrade` header is not
     * `websocket`.
     * Returns {@link MissingKeyHeaderError} if the `Sec-WebSocket-Key` header
     * is missing.
     * Returns {@link InvalidKeyHeaderError} if the `Sec-WebSocket-Key` header
     * is invalid.
     * Returns {@link MissingVersionHeaderError} if the `Sec-WebSocket-Version`
     * header is missing.
     * Returns {@link InvalidOrUnsupportedVersionHeaderError} if the
     * `Sec-WebSocket-Version` header is not `8` or `13`.
     */
    static fromHeaders(method: string | undefined, headers: types.WebSocketRequestHeaders): Result<WebSocketResponder, WebSocketResponderError>;
    /**
     * Creates a new
     * {@link types.MessageHandlerResult MessageHandlerResult\<WebSocketResponse>}
     * using this instance's {@link protocol} and {@link accept}.
     */
    response(options: WebSocketResponderOptions, cleanup?: types.Cleanup): types.MessageHandlerResult<types.WebSocketResponse>;
}
