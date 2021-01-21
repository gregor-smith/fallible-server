import { join as joinPath } from 'path'
import type { ReadStream, Stats } from 'fs'
import type { Readable } from 'stream'

import { asyncFallible, error, ok, Result } from 'fallible'
import { Formidable, FormidableFile } from 'formidable'
import rawBody from 'raw-body'
import { createReadStream, FileSystemError, stat } from 'fallible-fs'
import sanitiseFilename from 'sanitize-filename'

import { parseJSONString } from './general-utils.js'


export type ParseJSONStreamError =
    | { tag: 'InvalidSyntax' }
    | { tag: 'TooLarge' }
    | { tag: 'OtherError', error: unknown }


export type ParseJSONStreamArguments = {
    sizeLimit?: number
    encoding?: BufferEncoding
}


function hasTypeField(value: unknown): value is { type: unknown } {
    return typeof value === 'object'
        && value !== null
        && 'type' in value
}


export async function parseJSONStream(
    stream: Readable,
    {
        sizeLimit,
        encoding = 'utf-8'
    }: ParseJSONStreamArguments = {}
): Promise<Result<unknown, ParseJSONStreamError>> {
    let body: string
    try {
        body = await rawBody(stream, {
            encoding,
            limit: sizeLimit
        })
    }
    catch (exception: unknown) {
        return error(
            hasTypeField(exception) && exception.type === 'entity.too.large'
                ? { tag: 'TooLarge' }
                : { tag: 'OtherError', error: exception }
        )
    }

    const result = parseJSONString(body)
    return result.ok
        ? result
        : error({ tag: 'InvalidSyntax' })
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
    const form = new Formidable({
        enabledPlugins: [ 'multipart' ],
        encoding,
        keepExtensions: keepFileExtensions,
        uploadDir: saveDirectory,
        maxFieldsSize: fieldsSizeLimit,
        maxFileSize: fileSizeLimit
    })
    return new Promise(resolve => {
        form.parse(stream, (exception, fields, files) => {
            if (exception === null || exception === undefined) {
                resolve(
                    ok({ fields, files })
                )
                return
            }
            if (exception instanceof Error) {
                if (/maxFieldsSize/.test(exception.message)) {
                    resolve(
                        error({ tag: 'FieldsTooLarge' })
                    )
                    return
                }
                if (/maxFileSize/.test(exception.message)) {
                    resolve(
                        error({ tag: 'FilesTooLarge' })
                    )
                    return
                }
            }
            resolve(
                error({ tag: 'OtherError', error: exception })
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
            return error({ tag: 'IsADirectory' })
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
