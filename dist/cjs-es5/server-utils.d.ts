/// <reference types="node" />
import type { ReadStream } from 'fs';
import type { Readable } from 'stream';
import { Result } from 'fallible';
import { FormidableFile } from 'formidable';
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
    encoding?: string;
    parser?: (json: string) => Result<unknown, void>;
};
export declare function parseJSONStream(stream: Readable, { sizeLimit, encoding, parser }?: ParseJSONStreamArguments): Promise<Result<unknown, ParseJSONStreamError>>;
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
    encoding?: string;
    saveDirectory?: string;
    keepFileExtensions?: boolean;
    fileSizeLimit?: number;
    fieldsSizeLimit?: number;
};
export declare function parseMultipartStream(stream: Readable, { encoding, saveDirectory, keepFileExtensions, fileSizeLimit, fieldsSizeLimit }?: ParseMultipartStreamArguments): Promise<Result<ParsedMultipartStream, ParseMultipartStreamError>>;
export declare type OpenedFile = {
    stream: ReadStream;
    length: number;
};
export declare type OpenFileError = FileSystemError | {
    tag: 'IsADirectory';
    exception?: FileSystemError;
};
export declare function openFile(path: string): Promise<Result<OpenedFile, OpenFileError>>;
export declare function openFile(directory: string, filename: string): Promise<Result<OpenedFile, OpenFileError>>;
