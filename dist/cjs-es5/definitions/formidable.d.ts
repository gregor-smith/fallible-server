/// <reference types="node" />
declare module 'formidable' {
    import type { Readable } from 'stream';
    type FormidableFile = {
        size: number;
        path: string | null;
        name: string | null;
        type: string | null;
        lastModifiedDate: Date | null;
    };
    type FormidableOptions = {
        enabledPlugins?: ['multipart'];
        encoding?: string;
        uploadDir?: string;
        keepExtensions?: boolean;
        maxFileSize?: number;
        maxFieldsSize?: number;
    };
    class Formidable {
        constructor(options: FormidableOptions);
        parse(stream: Readable, callback: (error: unknown, fields: Record<string, string>, files: Record<string, FormidableFile>) => void): void;
    }
}
