import { Server, createServer, RequestListener, IncomingHttpHeaders } from 'http'

import URLParse from 'url-parse'
import Cookies from 'cookies'


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


type RequestArguments = {
    cookie: (key: string) => string | undefined
    behindProxy: boolean
    ip: string
    method: Method
    headers: IncomingHttpHeaders
    url: string
}


export class Request {
    private readonly behindProxy: boolean
    private readonly _ip: string
    private _parsedURL?: Readonly<ParsedURL>
    private _parsedContentType?: Readonly<ParsedContentType>

    public readonly cookie: (key: string) => string | undefined
    public readonly method: Method
    public readonly headers: Readonly<IncomingHttpHeaders>
    public readonly url: string

    public constructor({ cookie, behindProxy, ip, method, headers, url }: RequestArguments) {
        this.cookie = cookie
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
            const header = this.headers['content-type']
            if (header === undefined) {
                return undefined
            }
            const match = /^\s*(?:(.+?)\s*;\s*charset="?(.+?)"?|(.+))\s*$/
                .exec(header)
            if (match === null) {
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

    public get ip(): string {
        if (!this.behindProxy) {
            return this._ip
        }
        return this.header('x-forwarded-proto') ?? this._ip
    }
}


// export type Middleware<ExistingState, NewState, Errors> =


export type FallibleServerOptions = {
    secretKey: string
    behindProxy: boolean
}


export class FallibleServer<State, Errors> {
    public secretKey: string
    public behindProxy: boolean

    public requestListener(): RequestListener {
        return (request, response) => {

        }
    }

    public create(options: { maxHeaderSize?: number } = {}): Server {
        return createServer(options, this.requestListener())
    }

    public listen(options: { host?: string, port?: number, callback?: () => void } = {}): Server {
        return this.create()
            .listen(options, options.callback)
    }
}
