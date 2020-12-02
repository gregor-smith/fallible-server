import { error, ok, Result } from 'fallible'
import { Formidable, FormidableFile } from 'formidable'
import rawBody from 'raw-body'
import { parse as secureJSONParse } from 'secure-json-parse'

import type { MessageHandler } from './types'
import { getMessageHeader } from './utils'


export type ParseAuthorisationBearerError =
    | 'HeaderMissing'
    | 'HeaderInvalid'


export type ParseAuthorisationBearerState = {
    authorisationToken: Result<string, ParseAuthorisationBearerError>
}


export function parseAuthorisationBearer<State, Error>(): MessageHandler<State, ParseAuthorisationBearerState, Error> {
    return (message, state) => {
        let authorisationToken: ParseAuthorisationBearerState['authorisationToken']
        const header = getMessageHeader(message, 'Authorization')
        if (header === undefined) {
            authorisationToken = error('HeaderMissing')
        }
        else {
            const token = header.match(/^Bearer (.+)/)?.[1]
            authorisationToken = token === undefined
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


export function getIsWebSocket<State, Error>(): MessageHandler<State, GetWebSocketState, Error> {
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
    body: Result<unknown, ParseJSONBodyError>
}


function hasTypeField(value: unknown): value is { type: string } {
    return typeof value === 'object'
        && value !== null
        && 'type' in value
        && typeof (value as { type: unknown }).type === 'string'
}


export type ParseJSONBodyOptions = {
    sizeLimit?: number
    encoding?: string
}


export function parseJSONBody<State, Error>(
    {
        sizeLimit,
        encoding = 'utf-8'
    }: ParseJSONBodyOptions = {}
): MessageHandler<State, ParseJSONBodyState, Error> {
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
                    body: error(
                        hasTypeField(exception) && exception.type === 'entity.too.large'
                            ? { tag: 'TooLarge' }
                            : { tag: 'OtherError', error: exception }
                    )
                }
            })
        }

        let json: unknown
        try {
            json = secureJSONParse(body)
        }
        catch {
            return ok({
                state: {
                    ...state,
                    body: error({ tag: 'InvalidSyntax' })
                }
            })
        }

        return ok({
            state: {
                ...state,
                body: ok(json)
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
    body: Result<ParsedMultipartBody, ParseMultipartBodyError>
}


export type ParseMultipartBodyOptions = {
    encoding?: string
    saveDirectory?: string
    keepFileExtensions?: boolean
    fileSizeLimit?: number
    fieldsSizeLimit?: number
}


export function parseMultipartBody<State, Error>(
    {
        encoding = 'utf-8',
        saveDirectory,
        keepFileExtensions,
        fileSizeLimit,
        fieldsSizeLimit
    }: ParseMultipartBodyOptions = {}
): MessageHandler<State, ParseMultipartBodyState, Error> {
    return async (message, state) => {
        const form = new Formidable({
            enabledPlugins: [ 'multipart' ],
            encoding,
            keepExtensions: keepFileExtensions,
            uploadDir: saveDirectory,
            maxFieldsSize: fieldsSizeLimit,
            maxFileSize: fileSizeLimit
        })
        const body = await new Promise<ParseMultipartBodyState['body']>(resolve => {
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
                    resolve(
                        error({ tag: 'OtherError', error: exception })
                    )
                    return
                }
                resolve(
                    error({ tag: 'OtherError', error: exception })
                )
            })
        })
        return ok({
            state: {
                ...state,
                body
            }
        })
    }
}
