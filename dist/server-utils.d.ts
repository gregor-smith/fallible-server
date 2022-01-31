/// <reference types="node" />
import type { ReadStream, Stats } from 'node:fs';
import type { Readable } from 'node:stream';
import { Awaitable, Result } from 'fallible';
import { FileSystemError } from 'fallible-fs';
export declare type ReadBufferStreamError = {
    tag: 'LimitExceeded';
} | {
    tag: 'StreamClosed';
} | {
    tag: 'NonBufferChunk';
    chunk: unknown;
} | {
    tag: 'OtherError';
    error: unknown;
};
export declare function readBufferStream(request: Readable, limit?: number): Awaitable<Result<Buffer, ReadBufferStreamError>>;
export declare type ParseJSONStreamError = ReadBufferStreamError | {
    tag: 'InvalidSyntax';
};
export declare function parseJSONStream(stream: Readable, limit?: number): Promise<Result<unknown, ParseJSONStreamError>>;
export declare type ParseMultipartStreamError = {
    tag: 'FilesTooLarge';
} | {
    tag: 'FieldsTooLarge';
} | {
    tag: 'OtherError';
    error: unknown;
};
export declare type File = {
    size: number;
    path: string;
    name: string;
    mimetype: string;
    dateModified: Date;
};
export declare type ParsedMultipartStream = {
    fields: Record<string, string>;
    files: Record<string, File>;
};
export declare type ParseMultipartStreamArguments = {
    encoding?: BufferEncoding;
    saveDirectory?: string;
    keepFileExtensions?: boolean;
    fileSizeLimit?: number;
    fieldsSizeLimit?: number;
};
export declare function parseMultipartStream(stream: Readable, { encoding, saveDirectory, keepFileExtensions, fileSizeLimit, fieldsSizeLimit }?: ParseMultipartStreamArguments): Promise<Result<ParsedMultipartStream, ParseMultipartStreamError>>;
export declare type OpenedFile = {
    stream: ReadStream;
    stats: Stats;
};
export declare type OpenFileError = FileSystemError | {
    tag: 'IsADirectory';
    exception?: FileSystemError;
};
export declare function openFile(path: string, encoding?: BufferEncoding): Promise<Result<OpenedFile, OpenFileError>>;
export declare function openSanitisedFile(directory: string, filename: string, encoding?: BufferEncoding): Promise<Result<OpenedFile, OpenFileError>>;
