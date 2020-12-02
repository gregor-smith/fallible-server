import { Result } from 'fallible';
import { FormidableFile } from 'formidable';
import type { MessageHandler } from './types';
export declare type ParseAuthorisationBearerError = 'HeaderMissing' | 'HeaderInvalid';
export declare type ParseAuthorisationBearerState = {
    authorisationToken: Result<string, ParseAuthorisationBearerError>;
};
export declare function parseAuthorisationBearer<State, Error>(): MessageHandler<State, ParseAuthorisationBearerState, Error>;
export declare type GetWebSocketState = {
    isWebSocket: boolean;
};
export declare function getIsWebSocket<State, Error>(): MessageHandler<State, GetWebSocketState, Error>;
export declare type ParseJSONBodyError = {
    tag: 'InvalidSyntax';
} | {
    tag: 'TooLarge';
} | {
    tag: 'OtherError';
    error: unknown;
};
export declare type ParseJSONBodyState = {
    body: Result<unknown, ParseJSONBodyError>;
};
export declare type ParseJSONBodyOptions = {
    sizeLimit?: number;
    encoding?: string;
};
export declare function parseJSONBody<State, Error>({ sizeLimit, encoding }?: ParseJSONBodyOptions): MessageHandler<State, ParseJSONBodyState, Error>;
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
    body: Result<ParsedMultipartBody, ParseMultipartBodyError>;
};
export declare type ParseMultipartBodyOptions = {
    encoding?: string;
    saveDirectory?: string;
    keepFileExtensions?: boolean;
    fileSizeLimit?: number;
    fieldsSizeLimit?: number;
};
export declare function parseMultipartBody<State, Error>({ encoding, saveDirectory, keepFileExtensions, fileSizeLimit, fieldsSizeLimit }?: ParseMultipartBodyOptions): MessageHandler<State, ParseMultipartBodyState, Error>;
