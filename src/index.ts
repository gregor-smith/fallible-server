import type { RequestListener, IncomingHttpHeaders } from 'http'
import type { Readable } from 'stream'

import URLParse from 'url-parse'
import Cookies, { SetOption } from 'cookies'
import { Result, Awaitable, asyncFallible, ok } from 'fallible'


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


export type ParsedURL = {
    protocol: string
    host: string
    path: ReadonlyArray<string>
    query: Readonly<Partial<Record<string, string>>>
    hash: string
}


export type ParsedContentType = {
    type: string
    characterSet?: string
}


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
        if (this._parsedContentType === undefined) {
            const match = this.headers['content-type']
                ?.match(/^\s*(?:(.+?)\s*;\s*charset="?(.+?)"?|(.+))\s*$/)
            if (match === null || match === undefined) {
                return undefined
            }
            const [ , type, characterSet, full ] = match as (string | undefined)[]
            this._parsedContentType = {
                type: type?.toLowerCase() ?? full!.toLowerCase(),
                characterSet: characterSet?.toLowerCase()
            }
        }
        return this._parsedContentType
    }

    public get parsedURL(): Readonly<ParsedURL> {
        if (this._parsedURL === undefined) {
            const { protocol, host, pathname, query, hash } = URLParse(this.url, true)

            const path: string[] = []
            for (const segment of pathname.split('/')) {
                const decoded = decodeURIComponent(segment).trim()
                if (decoded.length === 0) {
                    continue
                }
                path.push(decoded)
            }

            this._parsedURL = {
                protocol,
                host,
                path,
                query,
                hash: hash.slice(1)
            }
        }

        return this._parsedURL
    }

    public get protocol(): string {
        if (!this.behindProxy) {
            return this.parsedURL.protocol
        }
        return this.header('x-forwarded-proto') ?? this.parsedURL.protocol
    }

    public get host(): string {
        return this.parsedURL.host
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

export type Cleanup<State, Errors> = (
    response: Readonly<Response>,
    state: Readonly<State>
) => Awaitable<Result<void, Errors>>

export type RequestHandlerResult<ExistingState, NewState, Errors> = {
    state: ExistingState & NewState
    cleanup?: Cleanup<ExistingState & NewState, Errors>
}

export type RequestHandler<ExistingState, NewState, Errors> = (
    request: Request,
    state: Readonly<ExistingState>
) => Awaitable<Result<RequestHandlerResult<ExistingState, NewState, Errors>, Errors>>

export type ResponseHandler<State, Errors> = (
    state: Readonly<State>
) => Awaitable<Result<Response, Errors>>

export type ErrorHandler<Errors> = (
    error: Readonly<Errors>
) => Awaitable<Response>


export type CreateRequestListenerArguments<State, Errors> = {
    secretKey: string
    behindProxy?: boolean
    requestHandler: RequestHandler<void, State, Errors>
    responseHandler: ResponseHandler<State, Errors>
    errorHandler: ErrorHandler<Errors>
}


export function createRequestListener<State, Errors>({
    secretKey,
    behindProxy = false,
    requestHandler,
    responseHandler,
    errorHandler
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
        const result = await asyncFallible<Response, Errors>(async propagate => {
            const { state, cleanup } = propagate(await requestHandler(request))
            const response = propagate(await responseHandler(state))
            await cleanup?.(response, state)
            return ok(response)
        })
        const response = result.ok
            ? result.value
            : await errorHandler(result.value)

        res.statusCode = response.status ?? (result.ok ? 200 : 500)

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
