import type { IncomingMessage } from 'node:http'
import { TextDecoder } from 'node:util'

import { parse as secureJSONParse } from 'secure-json-parse'
import { error, ok, Result } from 'fallible'
import { Formidable, errors as formidableErrors } from 'formidable'

import type { AwaitableIterable } from './types.js'


export type ParseJSONStreamError =
    | { tag: 'MaximumSizeExceeded' }
    | { tag: 'DecodeError', error: unknown }
    | { tag: 'InvalidSyntax' }

export type ParseJSONStreamOptions = {
    maximumSize?: number
    encoding?: BufferEncoding
}

export async function parseJSONStream(
    stream: AwaitableIterable<Uint8Array>,
    {
        maximumSize = Infinity,
        encoding = 'utf-8'
    }: ParseJSONStreamOptions = {}
): Promise<Result<unknown, ParseJSONStreamError>> {
    let size = 0
    const chunks: Uint8Array[] = []
    for await (const chunk of stream) {
        size += chunk.byteLength
        if (size > maximumSize) {
            return error({ tag: 'MaximumSizeExceeded' } as const)
        }
        chunks.push(chunk)
    }

    const buffer = Buffer.concat(chunks)
    let text: string
    try {
        text = new TextDecoder(encoding, { fatal: true }).decode(buffer)
    }
    catch (exception) {
        return error({ tag: 'DecodeError', error: exception } as const)
    }

    let value: unknown
    try {
        value = secureJSONParse(text)
    }
    catch {
        return error({ tag: 'InvalidSyntax' } as const)
    }

    return ok(value)
}


export type ParseMultipartRequestError =
    | { tag: 'InvalidMultipartContentTypeHeader' }
    | { tag: 'RequestAborted' }
    | { tag: 'BelowMinimumFileSize' }
    | { tag: 'MaximumFileCountExceeded' }
    | { tag: 'MaximumFileSizeExceeded' }
    | { tag: 'MaximumTotalFileSizeExceeded' }
    | { tag: 'MaximumFieldsCountExceeded' }
    | { tag: 'MaximumFieldsSizeExceeded' }
    | { tag: 'UnknownError', error: unknown }

export type MultipartFile = {
    size: number
    path: string
    mimetype: string
    dateModified: Date
}

export type ParsedMultipart = {
    fields: Record<string, string>
    files: Record<string, MultipartFile>
}

export type ParseMultipartRequestArguments = {
    encoding?: BufferEncoding
    saveDirectory?: string
    keepFileExtensions?: boolean
    minimumFileSize?: number
    maximumFileCount?: number
    maximumFileSize?: number
    maximumFieldsCount?: number
    maximumFieldsSize?: number
}

// TODO: replace with async generator
export function parseMultipartRequest(
    request: IncomingMessage,
    {
        encoding,
        saveDirectory,
        keepFileExtensions,
        minimumFileSize = 0,
        maximumFileCount = Infinity,
        maximumFileSize = Infinity,
        maximumFieldsCount = Infinity,
        maximumFieldsSize = Infinity
    }: ParseMultipartRequestArguments = {}
): Promise<Result<ParsedMultipart, ParseMultipartRequestError>> {
    return new Promise(resolve => {
        new Formidable({
            enabledPlugins: [ 'multipart' ],
            encoding,
            keepExtensions: keepFileExtensions,
            uploadDir: saveDirectory,
            allowEmptyFiles: true,
            minFileSize: minimumFileSize,
            maxFiles: maximumFileCount,
            maxFileSize: maximumFileSize,
            maxTotalFileSize: maximumFileCount * maximumFileSize,
            maxFields: maximumFieldsCount,
            maxFieldsSize: maximumFieldsSize
        }).parse(request, (exception, fields, files) => {
            if (exception !== null && exception !== undefined) {
                return resolve(error(getError(exception)))
            }
            const newFiles: Record<string, MultipartFile> = {}
            for (const [ name, file ] of Object.entries(files)) {
                newFiles[name] = {
                    size: file.size,
                    path: file.filepath,
                    mimetype: file.mimetype,
                    dateModified: file.lastModifiedDate
                }
            }
            resolve(ok({
                fields,
                files: newFiles
            }))
        })
    })
}

function getError(error: unknown): ParseMultipartRequestError {
    if (!(error instanceof formidableErrors.default)) {
        return { tag: 'UnknownError', error }
    }
    switch (error.code) {
        case formidableErrors.malformedMultipart:
            return { tag: 'InvalidMultipartContentTypeHeader' }
        case formidableErrors.aborted:
            return { tag: 'RequestAborted' }
        case formidableErrors.maxFilesExceeded:
            return { tag: 'MaximumFileCountExceeded' }
        case formidableErrors.biggerThanMaxFileSize:
            return { tag: 'MaximumFileSizeExceeded' }
        case formidableErrors.biggerThanTotalMaxFileSize:
            return { tag: 'MaximumTotalFileSizeExceeded' }
        case formidableErrors.maxFieldsExceeded:
            return { tag: 'MaximumFieldsCountExceeded' }
        case formidableErrors.maxFieldsSizeExceeded:
            return { tag: 'MaximumFieldsSizeExceeded' }
        case formidableErrors.smallerThanMinFileSize:
            return { tag: 'BelowMinimumFileSize' }
        default:
            return { tag: 'UnknownError', error }
    }
}
