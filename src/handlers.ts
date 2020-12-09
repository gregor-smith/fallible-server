import type { ReadStream } from 'fs'
import { asyncFallible, error, ok, Result } from 'fallible'
import { Formidable, FormidableFile } from 'formidable'
import rawBody from 'raw-body'
import { parse as secureJSONParse } from 'secure-json-parse'
import { createReadStream, FileSystemError, stat } from 'fallible-fs'

import type { MessageHandler } from './types'
import { getMessageHeader } from './utils'


export type ParseAuthorisationBearerError =
    | 'HeaderMissing'
    | 'HeaderInvalid'


export type ParseAuthorisationBearerState = {
    authorisationToken: Result<string, ParseAuthorisationBearerError>
}


export function parseAuthorisationBearer<State extends {}, Error>(): MessageHandler<State, State & ParseAuthorisationBearerState, Error> {
    return (message, state) => {
        let authorisationToken: ParseAuthorisationBearerState['authorisationToken']
        const header = getMessageHeader(message, 'Authorization')
        if (header === undefined) {
            authorisationToken = error('HeaderMissing')
        }
        else {
            const token = header.match(/^Bearer (.+)/)
                ?.[1]
                ?.trim()
            authorisationToken = token === undefined || token.length === 0
                ? error('HeaderInvalid')
                : ok(token)
        }
        return ok({
            state: {
                ...state,
                authorisationToken
            }
        })
    }
}


export type GetWebSocketState = {
    isWebSocket: boolean
}


export function getIsWebSocket<State extends {}, Error>(): MessageHandler<State, State & GetWebSocketState, Error> {
    return (message, state) =>
        ok({
            state: {
                ...state,
                isWebSocket: getMessageHeader(message, 'upgrade') === 'websocket'
            }
        })
}


export type ParseJSONBodyError =
    | { tag: 'InvalidSyntax' }
    | { tag: 'TooLarge' }
    | { tag: 'OtherError', error: unknown }


export type ParseJSONBodyState = {
    body: {
        json: Result<unknown, ParseJSONBodyError>
    }
}


function hasTypeField(value: unknown): value is { type: string } {
    return typeof value === 'object'
        && value !== null
        && 'type' in value
        && typeof (value as { type: unknown }).type === 'string'
}


export type ParseJSONBodyOptions = {
    sizeLimit?: number
    encoding?: string,
    parser?: (json: string) => unknown
}


export function parseJSONBody<State extends {}, Error>(
    {
        sizeLimit,
        encoding = 'utf-8',
        parser = secureJSONParse
    }: ParseJSONBodyOptions = {}
): MessageHandler<State, State & ParseJSONBodyState, Error> {
    return async (message, state) => {
        let body: string
        try {
            body = await rawBody(message, {
                encoding,
                limit: sizeLimit
            })
        }
        catch (exception: unknown) {
            return ok({
                state: {
                    ...state,
                    body: {
                        json: error(
                            hasTypeField(exception) && exception.type === 'entity.too.large'
                                ? { tag: 'TooLarge' }
                                : { tag: 'OtherError', error: exception }
                        )
                    }
                }
            })
        }

        let json: unknown
        try {
            json = parser(body)
        }
        catch {
            return ok({
                state: {
                    ...state,
                    body: {
                        json: error({ tag: 'InvalidSyntax' })
                    }
                }
            })
        }

        return ok({
            state: {
                ...state,
                body: {
                    json: ok(json)
                }
            }
        })
    }
}


export type ParseMultipartBodyError =
    | { tag: 'FilesTooLarge' }
    | { tag: 'FieldsTooLarge' }
    | { tag: 'OtherError', error: unknown }


export type ParsedMultipartBody = {
    fields: Record<string, string>
    files: Record<string, FormidableFile>
}


export type ParseMultipartBodyState = {
    body: {
        multipart: Result<ParsedMultipartBody, ParseMultipartBodyError>
    }
}


export type ParseMultipartBodyOptions = {
    encoding?: string
    saveDirectory?: string
    keepFileExtensions?: boolean
    fileSizeLimit?: number
    fieldsSizeLimit?: number
}


export function parseMultipartBody<State extends {}, Error>(
    {
        encoding = 'utf-8',
        saveDirectory,
        keepFileExtensions,
        fileSizeLimit,
        fieldsSizeLimit
    }: ParseMultipartBodyOptions = {}
): MessageHandler<State, State & ParseMultipartBodyState, Error> {
    return async (message, state) => {
        const form = new Formidable({
            enabledPlugins: [ 'multipart' ],
            encoding,
            keepExtensions: keepFileExtensions,
            uploadDir: saveDirectory,
            maxFieldsSize: fieldsSizeLimit,
            maxFileSize: fileSizeLimit
        })
        const body = await new Promise<ParseMultipartBodyState['body']['multipart']>(resolve => {
            form.parse(message, (exception, fields, files) => {
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
        return ok({
            state: {
                ...state,
                body: {
                    multipart: body
                }
            }
        })
    }
}



export type OpenedFile = {
    stream: ReadStream
    contentLength: number
}


export type SendFileExistingState = {
    sendFile: {
        path: string
    }
}


export type SendFileState = {
    sendFile: {
        file: Result<OpenedFile, FileSystemError | Omit<FileSystemError, 'exception'>>
    }
}


export function sendFile<State extends SendFileExistingState, Error>(): MessageHandler<State, State & SendFileState, Error> {
    return async (_, state) => {
        const file = await asyncFallible<OpenedFile, FileSystemError | Omit<FileSystemError, 'exception'>>(async propagate => {
            const stats = propagate(await stat(state.sendFile.path))
            // this check is necessary because createReadStream fires the ready
            // event before the error event when trying to open a directory
            // see https://github.com/nodejs/node/issues/31583
            if (stats.isDirectory()) {
                return error({ tag: 'IsADirectory' })
            }
            const stream = propagate(await createReadStream(state.sendFile.path))

            return ok({
                stream,
                contentLength: stats.size
            })
        })
        return ok({
            state: {
                ...state,
                sendFile: { ...state.sendFile, file }
            }
        })
    }
}
