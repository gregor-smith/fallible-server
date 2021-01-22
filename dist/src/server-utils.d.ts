/// <reference types="node" />
import type { ReadStream, Stats } from 'fs';
import type { Readable } from 'stream';
import { Result } from 'fallible';
import { File as FormidableFile } from 'formidable';
import { FileSystemError } from 'fallible-fs';
export declare type ParseJSONStreamError = {
    tag: 'InvalidSyntax';
} | {
    tag: 'TooLarge';
} | {
    tag: 'OtherError';
    error: unknown;
};
export declare type ParseJSONStreamArguments = {
    sizeLimit?: number;
    encoding?: BufferEncoding;
};
export declare function parseJSONStream(stream: Readable, { sizeLimit, encoding }?: ParseJSONStreamArguments): Promise<Result<unknown, ParseJSONStreamError>>;
export declare type ParseMultipartStreamError = {
    tag: 'FilesTooLarge';
} | {
    tag: 'FieldsTooLarge';
} | {
    tag: 'OtherError';
    error: unknown;
};
export declare type ParsedMultipartStream = {
    fields: Record<string, string>;
    files: Record<string, FormidableFile>;
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
