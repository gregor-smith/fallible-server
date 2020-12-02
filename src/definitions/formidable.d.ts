declare module 'formidable' {
    import type { Readable } from 'stream'

    export type FormidableFile = {
        size: number
        path: string | null
        name: string | null
        type: string | null
        lastModifiedDate: Date | null
    }

    export type FormidableOptions = {
        enabledPlugins?: [ 'multipart' ]
        encoding?: string
        uploadDir?: string
        keepExtensions?: boolean
        maxFileSize?: number
        maxFieldsSize?: number
    }

    export class Formidable {
        public constructor(options: FormidableOptions)

        public parse(
            stream: Readable,
            callback: (
                error: unknown,
                fields: Record<string, string>,
                files: Record<string, FormidableFile>
            ) => void
        ): void
    }
}
