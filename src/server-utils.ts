import { join as joinPath } from 'path'
import type { ReadStream, Stats } from 'fs'
import type { Readable } from 'stream'

import { parse as secureJSONParse } from 'secure-json-parse'
import { asyncFallible, Awaitable, error, ok, Result } from 'fallible'
import { Formidable, File as FormidableFile } from 'formidable'
import sanitiseFilename from 'sanitize-filename'
import { createReadStream, FileSystemError, stat } from 'fallible-fs'


export type ReadBufferStreamError =
    | { tag: 'LimitExceeded' }
    | { tag: 'StreamClosed' }
    | { tag: 'NonBufferChunk', chunk: unknown }
    | { tag: 'OtherError', error: unknown }


export function readBufferStream(
    request: Readable,
    limit = Number.POSITIVE_INFINITY
): Awaitable<Result<Buffer, ReadBufferStreamError>> {
    if (request.destroyed) {
        return error({ tag: 'StreamClosed' } as const)
    }
    return new Promise(resolve => {
        const chunks: Buffer[] = []
        let length = 0

        const onData = (chunk: unknown): void => {
            if (!(chunk instanceof Buffer)) {
                cleanup()
                const result = error({ tag: 'NonBufferChunk', chunk } as const)
                return resolve(result)
            }
            if (request.destroyed) {
                cleanup()
                const result = error({ tag: 'StreamClosed' } as const)
                return resolve(result)
            }
            length += chunk.length
            if (length > limit) {
                cleanup()
                const result = error({ tag: 'LimitExceeded' } as const)
                return resolve(result)
            }
            chunks.push(chunk)
        }

        const onEnd = (): void => {
            cleanup()
            const buffer = Buffer.concat(chunks)
            const result = ok(buffer)
            resolve(result)
        }

        const onError = (exception: Error): void => {
            cleanup()
            const result = error({
                tag: 'OtherError',
                error: exception
            } as const)
            resolve(result)
        }

        const onClose = (): void => {
            cleanup()
            const result = error({ tag: 'StreamClosed' } as const)
            return resolve(result)
        }

        const cleanup = (): void => {
            request.off('data', onData)
            request.off('error', onError)
            request.off('end', onEnd)
            request.off('close', onClose)
        }

        request.on('data', onData)
        request.once('end', onEnd)
        request.once('error', onError)
        request.once('close', onClose)
    })
}



export type ParseJSONStreamError = ReadBufferStreamError | { tag: 'InvalidSyntax' }


export function parseJSONStream(
    stream: Readable,
    limit?: number
): Promise<Result<unknown, ParseJSONStreamError>> {
    return asyncFallible(async propagate => {
        const buffer = propagate(await readBufferStream(stream, limit))
        let text: string
        try {
            // not sure if this can throw but just in case
            text = buffer.toString('utf-8')
        }
        catch (exception) {
            return error({ tag: 'OtherError', error: exception } as const)
        }
        let value: unknown
        try {
            value = secureJSONParse(text)
        }
        catch {
            return error({ tag: 'InvalidSyntax' } as const)
        }
        return ok(value)
    })
}


export type ParseMultipartStreamError =
    | { tag: 'FilesTooLarge' }
    | { tag: 'FieldsTooLarge' }
    | { tag: 'OtherError', error: unknown }


export type ParsedMultipartStream = {
    fields: Record<string, string>
    files: Record<string, FormidableFile>
}


export type ParseMultipartStreamArguments = {
    encoding?: BufferEncoding
    saveDirectory?: string
    keepFileExtensions?: boolean
    fileSizeLimit?: number
    fieldsSizeLimit?: number
}


export function parseMultipartStream(
    stream: Readable,
    {
        encoding = 'utf-8',
        saveDirectory,
        keepFileExtensions,
        fileSizeLimit,
        fieldsSizeLimit
    }: ParseMultipartStreamArguments = {}
): Promise<Result<ParsedMultipartStream, ParseMultipartStreamError>> {
    return new Promise(resolve => {
        new Formidable({
            enabledPlugins: [ 'multipart' ],
            encoding,
            keepExtensions: keepFileExtensions,
            uploadDir: saveDirectory,
            maxFieldsSize: fieldsSizeLimit,
            maxFileSize: fileSizeLimit
        }).parse(stream, (exception, fields, files) => {
            if (exception === null || exception === undefined) {
                resolve(
                    ok({ fields, files })
                )
                return
            }
            if (exception instanceof Error) {
                if (/maxFieldsSize/.test(exception.message)) {
                    resolve(
                        error({ tag: 'FieldsTooLarge' } as const)
                    )
                    return
                }
                if (/maxFileSize/.test(exception.message)) {
                    resolve(
                        error({ tag: 'FilesTooLarge' } as const)
                    )
                    return
                }
            }
            resolve(
                error({ tag: 'OtherError', error: exception } as const)
            )
        })
    })
}


export type OpenedFile = {
    stream: ReadStream
    stats: Stats
}


export type OpenFileError =
    | FileSystemError
    | {
        tag: 'IsADirectory'
        exception?: FileSystemError
    }


export function openFile(path: string, encoding?: BufferEncoding): Promise<Result<OpenedFile, OpenFileError>> {
    return asyncFallible<OpenedFile, OpenFileError>(async propagate => {
        const stats = propagate(await stat(path))
        // this check is necessary because createReadStream fires the ready
        // event before the error event when trying to open a directory
        // see https://github.com/nodejs/node/issues/31583
        if (stats.isDirectory()) {
            return error({ tag: 'IsADirectory' } as const)
        }
        const stream = propagate(await createReadStream(path, encoding))

        return ok({ stream, stats })
    })
}


export function openSanitisedFile(
    directory: string,
    filename: string,
    encoding?: BufferEncoding
): Promise<Result<OpenedFile, OpenFileError>> {
    const path = joinPath(directory, sanitiseFilename(filename))
    return openFile(path, encoding)
}
