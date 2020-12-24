/// <reference types="node" />
import type { ReadStream } from 'fs';
import { Result } from 'fallible';
import { FormidableFile } from 'formidable';
import { FileSystemError } from 'fallible-fs';
import type { MessageHandler } from './types';
export declare type ParseJSONBodyError = {
    tag: 'InvalidSyntax';
} | {
    tag: 'TooLarge';
} | {
    tag: 'OtherError';
    error: unknown;
};
export declare type ParseJSONBodyState = {
    body: {
        json: Result<unknown, ParseJSONBodyError>;
    };
};
export declare type ParseJSONBodyOptions = {
    sizeLimit?: number;
    encoding?: string;
    parser?: (json: string) => unknown;
};
export declare function parseJSONBody<State extends {}, Error>({ sizeLimit, encoding, parser }?: ParseJSONBodyOptions): MessageHandler<State, State & ParseJSONBodyState, Error>;
export declare type ParseMultipartBodyError = {
    tag: 'FilesTooLarge';
} | {
    tag: 'FieldsTooLarge';
} | {
    tag: 'OtherError';
    error: unknown;
};
export declare type ParsedMultipartBody = {
    fields: Record<string, string>;
    files: Record<string, FormidableFile>;
};
export declare type ParseMultipartBodyState = {
    body: {
        multipart: Result<ParsedMultipartBody, ParseMultipartBodyError>;
    };
};
export declare type ParseMultipartBodyOptions = {
    encoding?: string;
    saveDirectory?: string;
    keepFileExtensions?: boolean;
    fileSizeLimit?: number;
    fieldsSizeLimit?: number;
};
export declare function parseMultipartBody<State extends {}, Error>({ encoding, saveDirectory, keepFileExtensions, fileSizeLimit, fieldsSizeLimit }?: ParseMultipartBodyOptions): MessageHandler<State, State & ParseMultipartBodyState, Error>;
export declare type OpenedFile = {
    stream: ReadStream;
    contentLength: number;
};
export declare type SendFileExistingState = {
    sendFile: {
        path: string;
    };
};
export declare type SendFileState = {
    sendFile: {
        file: Result<OpenedFile, FileSystemError | Omit<FileSystemError, 'exception'>>;
    };
};
export declare function sendFile<State extends SendFileExistingState, Error>(): MessageHandler<State, State & SendFileState, Error>;
