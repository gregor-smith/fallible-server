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
} | {
    tag: 'ReadError';
    error: unknown;
};
export declare type ParseJSONStreamOptions = {
    maximumSize?: number;
    encoding?: BufferEncoding;
};
export declare function parseJSONStream(stream: AwaitableIterable<Uint8Array>, { maximumSize, encoding }?: ParseJSONStreamOptions): Promise<Result<unknown, ParseJSONStreamError>>;
export declare type ParseMultipartRequestError = {
    tag: 'RequestAborted';
} | {
    tag: 'BelowMinimumFileSize';
} | {
    tag: 'MaximumFileCountExceeded';
} | {
    tag: 'MaximumFileSizeExceeded';
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
    encoding?: BufferEncoding;
    saveDirectory?: string;
    keepFileExtensions?: boolean;
    minimumFileSize?: number;
    maximumFileCount?: number;
    maximumFileSize?: number;
    maximumFieldsCount?: number;
    maximumFieldsSize?: number;
};
export declare function parseMultipartRequest(request: IncomingMessage, { encoding, saveDirectory, keepFileExtensions, minimumFileSize, maximumFileCount, maximumFileSize, maximumFieldsCount, maximumFieldsSize }?: ParseMultipartRequestArguments): Promise<Result<ParsedMultipart, ParseMultipartRequestError>>;
