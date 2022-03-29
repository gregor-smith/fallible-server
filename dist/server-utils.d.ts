/// <reference types="node" />
import type { IncomingMessage } from 'node:http';
import { Result } from 'fallible';
import type { AwaitableIterable } from './types.js';
export declare type ParseJSONStreamError = {
    tag: 'MaximumSizeExceeded';
} | {
    tag: 'DecodeError';
    error: unknown;
} | {
    tag: 'InvalidSyntax';
};
export declare type ParseJSONStreamOptions = {
    /**
     * Limits the maximum size of the stream; if this limit is exceeded,
     * an {@link ParseJSONStreamError error} is returned. By default unlimited.
     */
    maximumSize?: number;
    /**
     * Defaults to `utf-8`. If decoding fails, an
     * {@link ParseJSONStreamError error} is returned
     */
    encoding?: BufferEncoding;
};
export declare function parseJSONStream(stream: AwaitableIterable<Uint8Array>, { maximumSize, encoding }?: ParseJSONStreamOptions): Promise<Result<unknown, ParseJSONStreamError>>;
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
export declare function parseMultipartRequest(request: IncomingMessage, { encoding, saveDirectory, keepFileExtensions, minimumFileSize, maximumFileCount, maximumFileSize, maximumFieldsCount, maximumFieldsSize }?: ParseMultipartRequestArguments): Promise<Result<ParsedMultipart, ParseMultipartRequestError>>;
