import type { RequestListener, IncomingHttpHeaders } from 'http'
import type { Readable } from 'stream'

import Cookies, { SetOption } from 'cookies'
import { Result, Awaitable, asyncFallible, ok, Ok, error } from 'fallible'


export type ParsedURL = {
    path: ReadonlyArray<string>
    query: Readonly<Partial<Record<string, string>>>
    hash: string
}


function parseQueryString(queryString?: string) {
    if (queryString === undefined) {
        return {}
    }
    const query: Partial<Record<string, string>> = {}
    for (const pair of queryString.split('&')) {
        let [ key, value ] = pair.split('=')
        if (value === undefined) {
            continue
        }
        key = decodeURIComponent(key)
        value = decodeURIComponent(value)
        query[key] = value
    }
    return query
}


function parseHash(hash?: string) {
    if (hash === undefined) {
        return ''
    }
    return decodeURIComponent(hash)
}


function parsePath(path: string) {
    const segments: string[] = []
    for (let segment of path.split('/')) {
        segment = decodeURIComponent(segment)
        if (segment.length === 0) {
            continue
        }
        segments.push(segment)
    }
    return segments
}


function parseURL(url: string): ParsedURL {
    const match: (string | undefined)[] | null = /^(?:(.+)\?(.+)#(.+)|(.+)\?(.+)|(.+)#(.+))/.exec(url)
    return match === null
        ? {
            path: parsePath(url),
            query: {},
            hash: ''
        }
        : {
            path: parsePath(match[6] ?? match[4] ?? match[1] ?? url),
            query: parseQueryString(match[5] ?? match[2]),
            hash: parseHash(match[7] ?? match[3])
        }
}


export type ParsedContentType = {
    type: string
    characterSet?: string
}


function parseContentType(contentType?: string): ParsedContentType | undefined {
    if (contentType === undefined) {
        return undefined
    }

    const match = /^\s*(.+?)\s*;\s*charset\s*=\s*(")?(.+?)\2\s*$/i.exec(contentType)
    if (match == null) {
        contentType = contentType.trim()
        if (contentType.length === 0) {
            return undefined
        }
        return {
            type: contentType.toLowerCase()
        }
    }

    const [ , type, , characterSet ] = match
    return {
        type: type.toLowerCase(),
        characterSet: characterSet.toLowerCase()
    }
}


export type Method =
    | 'GET'
    | 'HEAD'
    | 'POST'
    | 'PUT'
    | 'PATCH'
    | 'DELETE'
    | 'TRACE'
    | 'OPTIONS'
    | 'CONNECT'


export type RequestArguments = {
    getCookie: (key: string) => string | undefined
    behindProxy: boolean
    ip?: string
    method: Method
    headers: IncomingHttpHeaders
    url: string
}


export class Request {
    private readonly behindProxy: boolean
    private readonly _ip?: string
    private _parsedURL?: Readonly<ParsedURL>
    private _parsedContentType?: Readonly<ParsedContentType>

    public readonly cookie: (key: string) => string | undefined
    public readonly method: Method
    public readonly headers: Readonly<IncomingHttpHeaders>
    public readonly url: string

    public constructor({ getCookie, behindProxy, ip, method, headers, url }: RequestArguments) {
        this.cookie = getCookie
        this.behindProxy = behindProxy
        this._ip = ip
        this.method = method
        this.headers = headers
        this.url = url
    }

    public header(key: string): string | undefined {
        const header = this.headers[key]
        return Array.isArray(header)
            ? header[0]
            : header
    }

    public get parsedContentType(): Readonly<ParsedContentType> | undefined {
        return this._parsedContentType ??= parseContentType(this.headers['content-type'])
    }

    public get parsedURL(): Readonly<ParsedURL> {
        return this._parsedURL ??= parseURL(this.url)
    }

    public get path(): ReadonlyArray<string> {
        return this.parsedURL.path
    }

    public get query(): Readonly<Partial<Record<string, string>>> {
        return this.parsedURL.query
    }

    public get hash(): string {
        return this.parsedURL.hash
    }

    public get contentLength(): number | undefined {
        const length = Number(this.headers['content-length'])
        return Number.isNaN(length) ? undefined : length
    }

    public get contentType(): string | undefined {
        return this.parsedContentType?.type
    }

    public get characterSet(): string | undefined {
        return this.parsedContentType?.characterSet
    }

    public get ip(): string | undefined {
        if (!this.behindProxy) {
            return this._ip
        }
        const header = this.header('x-forwarded-for')
        return header?.match(/^(.+?),/)
            ?.[1]
            ?.trim()
            ?? header?.trim()
            ?? this._ip
    }
}


export type Cookie = Omit<SetOption, 'secureProxy'> & { value: string }

export type Response = {
    cookies?: Readonly<Record<string, Readonly<Cookie>>>
    headers?: Readonly<Record<string, string | number>>
    status?: number
    body?: string | Buffer | Readable
}

export type Cleanup<Errors> = (
    response?: Readonly<Response>
) => Awaitable<Result<void, Errors>>

export type RequestHandlerResult<State, Errors> = {
    state: State
    cleanup?: Cleanup<Errors>
}

export type RequestHandler<ExistingState, NewState, Errors> = (
    request: Request,
    state: Readonly<ExistingState>
) => Awaitable<Result<RequestHandlerResult<ExistingState & NewState, Errors>, Errors>>

export type ResponseHandler<State, Errors> = (
    state: Readonly<State>
) => Awaitable<Result<Response, Errors>>

export type ErrorHandler<Errors> = (
    error: Readonly<Errors>
) => Awaitable<Response>


export function defaultErrorHandler(): Response {
    return {
        status: 500,
        body: 'Internal server error'
    }
}


export function defaultResponseHandler(): Ok<Response> {
    return ok({
        status: 200,
        body: ''
    })
}


export type CreateRequestListenerArguments<State, Errors> = {
    secretKey: string
    behindProxy?: boolean
    requestHandler: RequestHandler<{}, State, Errors>
    responseHandler?: ResponseHandler<State, Errors>
    errorHandler?: ErrorHandler<Errors>
}


export function createRequestListener<State, Errors>({
    secretKey,
    behindProxy = false,
    requestHandler,
    responseHandler = defaultResponseHandler,
    errorHandler = defaultErrorHandler
}: CreateRequestListenerArguments<State, Errors>): RequestListener {
    return async (req, res) => {
        const cookies = Cookies(req, res, { keys: [ secretKey ] })
        const request = new Request({
            getCookie: key => cookies.get(key, { signed: true }),
            behindProxy,
            headers: req.headers,
            ip: req.connection.remoteAddress ?? req.socket.remoteAddress,
            method: req.method?.toUpperCase() as Method | undefined ?? 'GET',
            url: req.url ?? '/'
        })

        let response: Response
        try {
            const result = await asyncFallible<Response, Errors>(async propagate => {
                const { state, cleanup } = propagate(await requestHandler(request, {}))
                const response = propagate(await responseHandler(state))
                if (cleanup !== undefined) {
                    propagate(await cleanup(response))
                }
                return ok(response)
            })
            response = result.ok
                ? result.value
                : await errorHandler(result.value)
        }
        catch {
            response = defaultErrorHandler()
        }

        res.statusCode = response.status ?? 200

        if (response.cookies !== undefined) {
            for (const [ key, { value, ...options } ] of Object.entries(response.cookies)) {
                cookies.set(key, value, options)
            }
        }

        if (response.headers !== undefined) {
            for (const [ key, value ] of Object.entries(response.headers)) {
                res.setHeader(key, value)
            }
        }

        if (typeof response.body === 'string') {
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', Buffer.byteLength(response.body))
            }
            res.end(response.body)
        }
        else if (response.body instanceof Buffer) {
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/octet-stream')
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', response.body.length)
            }
            res.end(response.body)
        }
        else if (response.body !== undefined) {
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/octet-stream')
            }
            response.body.pipe(res)
        }
        else {
            res.end()
        }
    }
}


async function composeCleanups<Errors>(
    cleanups: ReadonlyArray<Cleanup<Errors>>,
    response: Readonly<Response> | undefined,
    composeErrors: (errors: ReadonlyArray<Readonly<Errors>>) => Awaitable<Errors>
): Promise<Result<void, Errors>> {
    const errors: Errors[] = []
    for (let index = cleanups.length; index >= 0; index--) {
        const result = await cleanups[index](response)
        if (!result.ok) {
            errors.push(result.value)
        }
    }
    if (errors.length !== 0) {
        const composed = await composeErrors(errors)
        return error(composed)
    }
    return ok(undefined)
}


// there's probably some way to do this with variadic tuple types but fuck it
// see generateTypings.py in the root of the project
export function composeRequestHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
>(
    handlers: [
        RequestHandler<ExistingState, NewState1, Errors1>,
        RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2>>
    ) => Awaitable<Errors1 | Errors2>
): RequestHandler<
    ExistingState,
    NewState1 & NewState2,
    Errors1 | Errors2
>
export function composeRequestHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
    NewState3, Errors3,
>(
    handlers: [
        RequestHandler<ExistingState, NewState1, Errors1>,
        RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
        RequestHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3>>
    ) => Awaitable<Errors1 | Errors2 | Errors3>
): RequestHandler<
    ExistingState,
    NewState1 & NewState2 & NewState3,
    Errors1 | Errors2 | Errors3
>
export function composeRequestHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
    NewState3, Errors3,
    NewState4, Errors4,
>(
    handlers: [
        RequestHandler<ExistingState, NewState1, Errors1>,
        RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
        RequestHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4>>
    ) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4>
): RequestHandler<
    ExistingState,
    NewState1 & NewState2 & NewState3 & NewState4,
    Errors1 | Errors2 | Errors3 | Errors4
>
export function composeRequestHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
    NewState3, Errors3,
    NewState4, Errors4,
    NewState5, Errors5,
>(
    handlers: [
        RequestHandler<ExistingState, NewState1, Errors1>,
        RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
        RequestHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5>>
    ) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5>
): RequestHandler<
    ExistingState,
    NewState1 & NewState2 & NewState3 & NewState4 & NewState5,
    Errors1 | Errors2 | Errors3 | Errors4 | Errors5
>
export function composeRequestHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
    NewState3, Errors3,
    NewState4, Errors4,
    NewState5, Errors5,
    NewState6, Errors6,
>(
    handlers: [
        RequestHandler<ExistingState, NewState1, Errors1>,
        RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
        RequestHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>>
    ) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>
): RequestHandler<
    ExistingState,
    NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6,
    Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6
>
export function composeRequestHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
    NewState3, Errors3,
    NewState4, Errors4,
    NewState5, Errors5,
    NewState6, Errors6,
    NewState7, Errors7,
>(
    handlers: [
        RequestHandler<ExistingState, NewState1, Errors1>,
        RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
        RequestHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>>
    ) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>
): RequestHandler<
    ExistingState,
    NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7,
    Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7
>
export function composeRequestHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
    NewState3, Errors3,
    NewState4, Errors4,
    NewState5, Errors5,
    NewState6, Errors6,
    NewState7, Errors7,
    NewState8, Errors8,
>(
    handlers: [
        RequestHandler<ExistingState, NewState1, Errors1>,
        RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
        RequestHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7, NewState8, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>>
    ) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>
): RequestHandler<
    ExistingState,
    NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8,
    Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8
>
export function composeRequestHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
    NewState3, Errors3,
    NewState4, Errors4,
    NewState5, Errors5,
    NewState6, Errors6,
    NewState7, Errors7,
    NewState8, Errors8,
    NewState9, Errors9,
>(
    handlers: [
        RequestHandler<ExistingState, NewState1, Errors1>,
        RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
        RequestHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7, NewState8, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8, NewState9, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>>
    ) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>
): RequestHandler<
    ExistingState,
    NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8 & NewState9,
    Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9
>
export function composeRequestHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
    NewState3, Errors3,
    NewState4, Errors4,
    NewState5, Errors5,
    NewState6, Errors6,
    NewState7, Errors7,
    NewState8, Errors8,
    NewState9, Errors9,
    NewState10, Errors10,
>(
    handlers: [
        RequestHandler<ExistingState, NewState1, Errors1>,
        RequestHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
        RequestHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7, NewState8, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8, NewState9, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>,
        RequestHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8 & NewState9, NewState10, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9 | Errors10>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9 | Errors10>>
    ) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9 | Errors10>
): RequestHandler<
    ExistingState,
    NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8 & NewState9 & NewState10,
    Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9 | Errors10
>
export function composeRequestHandlers<Errors>(
    handlers: ReadonlyArray<RequestHandler<any, any, Errors>>,
    composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors>>) => Awaitable<Errors>
): RequestHandler<{}, any, Errors> {
    return async (request, state) => {
        const cleanups: Cleanup<Errors>[] = []

        for (const handler of handlers) {
            const result = await handler(request, state)
            if (!result.ok) {
                return asyncFallible(async propagate => {
                    propagate(await composeCleanups(cleanups, undefined, composeCleanupErrors))
                    return result
                })
            }
            state = result.value.state
            if (result.value.cleanup !== undefined) {
                cleanups.push(result.value.cleanup)
            }
        }

        return ok({
            state,
            cleanup: response =>
                composeCleanups(cleanups, response, composeCleanupErrors)
        })
    }
}
