declare module 'formidable' {
    import type { IncomingMessage } from 'node:http'

    export type FormidableOptions = {
        enabledPlugins: [ 'multipart' ]
        encoding?: BufferEncoding
        uploadDir?: string
        keepExtensions?: boolean
        allowEmptyFiles?: boolean
        minFileSize?: number
        maxFiles?: number
        maxFileSize?: number
        maxFields?: number
        maxFieldsSize?: number
        maxTotalFileSize?: number
    }

    export type FormidableFile = {
        size: number
        filepath: string
        newFilename: string
        originalFilename: string
        mimetype: string
        lastModifiedDate: Date
    }

    class InternalFormidableError extends Error {
        public code: number
    }

    // The FormidableError.js module exports the FormidableError class by
    // default and all the error code constants by name. The index.js module,
    // which is the only entry point to the library, then exports the entire
    // FormidableError.js module as 'errors'. Ideally a namespace declaration
    // should be used to type this, but namespaces do not support default
    // exports, so a type definition is used instead even though it's
    // technically incorrect.
    // See: https://stackoverflow.com/questions/61781645
    type Errors = {
        missingPlugin: number
        pluginFunction: number
        aborted: number
        noParser: number
        uninitializedParser: number
        filenameNotString: number
        maxFieldsSizeExceeded: number
        maxFieldsExceeded: number
        smallerThanMinFileSize: number
        biggerThanTotalMaxFileSize: number
        noEmptyFiles: number
        missingContentType: number
        malformedMultipart: number
        missingMultipartBoundary: number
        unknownTransferEncoding: number
        maxFilesExceeded: number
        biggerThanMaxFileSize: number
        pluginFailed: number
        default: typeof InternalFormidableError
    }

    export const errors: Errors

    export type FormidableError = InternalFormidableError

    export class Formidable {
        public constructor(options: FormidableOptions)
        public parse(
            message: IncomingMessage,
            callback: (
                exception: unknown,
                fields: Record<string, string>,
                files: Record<string, FormidableFile>
            ) => void
        ): void
    }
}
