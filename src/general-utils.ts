// This file should have no runtime dependencies on Node modules as some utils
// within are useful on both server and client. Exclusively server-only utils
// should go in ./server-utils.ts


import type { IncomingMessage } from 'node:http'

import type Keygrip from 'keygrip'
import { error, ok, Result } from 'fallible'

import type {
    Cleanup,
    Cookie,
    Formattable,
    MessageHandlerResult,
    Method,
    WebsocketBody,
    RegularResponse,
    WebsocketResponse
} from './types.js'


export { parse as parseJSONString } from 'secure-json-parse'


export const CloseWebsocket = Symbol()


export const enum WebsocketReadyState {
    Connecting,
    Open,
    Closing,
    Closed
}


export function contentDispositionHeader(type: 'inline'): 'inline'
export function contentDispositionHeader(type: 'attachment', filename?: undefined): 'attachment'
export function contentDispositionHeader(type: 'attachment', filename: string): `attachment; filename="${string}"`
export function contentDispositionHeader(type: string, filename?: string) {
    if (type === 'inline') {
        return type
    }
    if (filename !== undefined) {
        type = `${type}; filename="${encodeURIComponent(filename)}"`
    }
    return type
}


export function parseCookieHeader(header: string, name: string): string | undefined {
    return header.match(`(?:^|; )${name}=([^;]*)`)?.[1]
}


export function parseMessageCookie(
    message: Pick<IncomingMessage, 'headers'>,
    name: string
): string | undefined {
    if (message.headers.cookie === undefined) {
        return
    }
    return parseCookieHeader(message.headers.cookie, name)
}


function cookieKeyValuePair<A extends Formattable, B extends Formattable>(
    name: A,
    value: B
): `${A}=${B}` {
    return `${name}=${value}`
}


export function signatureCookieName<T extends Formattable>(name: T): `${T}.sig` {
    return `${name}.sig`
}


export type ParseSignedMessageCookieError =
    | 'ValueCookieMissing'
    | 'SignatureCookieMissing'
    | 'SignatureInvalid'


export type Keys = Pick<Keygrip, 'verify'>


export function parseSignedMessageCookie(
    message: Pick<IncomingMessage, 'headers'>,
    name: string,
    keys: Keys
): Result<string, ParseSignedMessageCookieError> {
    const value = parseMessageCookie(message, name)
    if (value === undefined) {
        return error('ValueCookieMissing' as const)
    }
    const signature = parseMessageCookie(message, signatureCookieName(name))
    if (signature === undefined) {
        return error('SignatureCookieMissing' as const)
    }
    if (!keys.verify(cookieKeyValuePair(name, value), signature)) {
        return error('SignatureInvalid' as const)
    }
    return ok(value)
}


export function cookieHeader(
    name: string,
    { value, path, maxAge, domain, sameSite, secure = false, httpOnly = false }: Cookie
): string {
    const segments: string[] = [ cookieKeyValuePair(name, value) ]
    if (path !== undefined) {
        segments.push(`Path=${path}`)
    }
    if (maxAge !== undefined) {
        segments.push(`Max-Age=${maxAge}`)
    }
    if (domain !== undefined) {
        segments.push(`Domain=${domain}`)
    }
    if (sameSite !== undefined) {
        segments.push(`SameSite=${sameSite}`)
    }
    if (secure) {
        segments.push('Secure')
    }
    if (httpOnly) {
        segments.push('HttpOnly')
    }
    return segments.join('; ')
}


export function signedCookieHeader(
    name: string,
    cookie: Readonly<Cookie>,
    keys: Pick<Keygrip, 'sign'>
): string {
    return cookieHeader(
        signatureCookieName(name),
        {
            ...cookie,
            value: keys.sign(
                cookieKeyValuePair(name, cookie.value)
            )
        }
    )
}


export function getMessageHeader(
    message: Pick<IncomingMessage, 'headers'>,
    name: string
): string | undefined {
    const header = message.headers[name]
    return Array.isArray(header)
        ? header[0]
        : header
}


export interface IncomingMessageIPFields {
    headers: IncomingMessage['headers']
    socket: Pick<IncomingMessage['socket'], 'remoteAddress'>
}


export function getMessageIP(
    message: IncomingMessageIPFields,
    useXForwardedFor = false
): string | undefined {
    if (!useXForwardedFor) {
        return message.socket.remoteAddress
    }
    return getMessageHeader(message, 'x-forwarded-for')
        ?.match(/^\s*([^\s]+)\s*(?:,|$)/)
        ?.[1]
        ?? message.socket.remoteAddress
}


export function getMessageMethod(message: Pick<IncomingMessage, 'method'>): Method {
    return message.method?.toUpperCase() as Method | undefined ?? 'GET'
}


export function getMessageURL(message: Pick<IncomingMessage, 'url'>): string {
    return message.url ?? '/'
}


export function parseURLQueryString(
    url: string,
    { skipEmptyValues = true, skipMissingValues = true } = {}
): Record<string, string> {
    const query: Record<string, string> = {}
    const matches = url.matchAll(/[\?&]([^\?&#=]+)(?:=([^\?&#]*))?(?=$|[\?&#])/g)
    for (let [ , key, value ] of matches as Iterable<[unknown, string, string | undefined ]>) {
        if (value === undefined) {
            if (skipMissingValues) {
                continue
            }
            value = ''
        }
        else if (value.length === 0 && skipEmptyValues) {
            continue
        }
        else {
            value = decodeURIComponent(value)
        }
        key = decodeURIComponent(key)
        query[key] = value
    }
    return query
}


export function joinURLQueryString(
    query: Record<string, string | number | bigint | boolean | null | undefined>
): string {
    const pairs: string[] = []
    for (let [ key, value ] of Object.entries(query)) {
        if (value === undefined) {
            continue
        }
        key = encodeURIComponent(key)
        value = encodeURIComponent(String(value))
        pairs.push(`${key}=${value}`)
    }
    return pairs.length === 0
        ? ''
        : ('?' + pairs.join('&'))
}


export function parseURLHash(url: string): string {
    const match = url.match(/#(.+)/)?.[1]
    return match === undefined
        ? ''
        : decodeURIComponent(match)
}


export function parseURLPath(url: string): string {
    return '/' + [ ...parseURLPathSegments(url) ].join('/')
}


export function * parseURLPathSegments(url: string): Generator<string, void> {
    for (const [ segment ] of url.matchAll(/(?<=\/)[^\/\?#]+/g) as Iterable<[ string ]>) {
        yield decodeURIComponent(segment)
    }
}


export type ParsedContentType = {
    type: string
    characterSet?: string
}


export function parseContentTypeHeader(header: string): ParsedContentType | undefined {
    const match = header.match(/^\s*(.+?)\s*;\s*charset\s*=\s*(")?(.+?)\2\s*$/i)
    if (match === null) {
        header = header.trim()
        if (header.length === 0) {
            return
        }
        return {
            type: header.toLowerCase()
        }
    }

    const [ , type, , characterSet ] = match as [ unknown, string, unknown, string ]
    return {
        type: type.toLowerCase(),
        characterSet: characterSet.toLowerCase()
    }
}


export function parseMessageContentType(message: Pick<IncomingMessage, 'headers'>): ParsedContentType | undefined {
    let contentType = message.headers['content-type']
    if (contentType === undefined) {
        return
    }
    return parseContentTypeHeader(contentType)
}


export function parseContentLengthHeader(header: string): number | undefined {
    // today i learnt passing an all whitespace string to Number gives you 0
    // to what end?
    if (!header.match(/[0-9]/)) {
        return
    }
    const length = Number(header)
    if (!Number.isSafeInteger(length)) {
        return
    }
    return length
}


export function parseMessageContentLength(message: Pick<IncomingMessage, 'headers'>): number | undefined {
    const header = message.headers['content-length']
    if (header === undefined) {
        return
    }
    return parseContentLengthHeader(header)
}


export function parseAuthorizationHeaderBearer(header: string): string | undefined {
    // See: https://datatracker.ietf.org/doc/html/rfc6750#section-2.1
    return header.match(/^Bearer ([a-zA-Z0-9\-\._\~\+\/]+)/)?.[1]
}


export type ParseMessageAuthorisationBearerError =
    | 'Missing'
    | 'Invalid'


export function parseMessageAuthorizationHeaderBearer(
    message: Pick<IncomingMessage, 'headers'>
): Result<string, ParseMessageAuthorisationBearerError> {
    if (message.headers.authorization === undefined) {
        return error('Missing' as const)
    }
    const token = parseAuthorizationHeaderBearer(message.headers.authorization)
    return token === undefined
        ? error('Invalid' as const)
        : ok(token)
}


export function messageIsWebSocketRequest(message: Pick<IncomingMessage, 'headers'>): boolean {
    return message.headers.connection?.toLowerCase() === 'upgrade'
        && message.headers.upgrade === 'websocket'
}


export function response(): MessageHandlerResult<RegularResponse>
export function response<T>(state: T, cleanup?: Cleanup): MessageHandlerResult<T>
export function response(state = {}, cleanup?: Cleanup) {
    return { state, cleanup }
}


export function websocketResponse(body: WebsocketBody, cleanup?: Cleanup): MessageHandlerResult<WebsocketResponse> {
    return response({ body }, cleanup)
}


export async function * iterateAsResolved<T>(
    promises: Iterable<PromiseLike<T>>
): AsyncGenerator<T, void, unknown> {
    const map = new Map<number, PromiseLike<[ number, T ]>>()
    let counter = 0
    for (const promise of promises) {
        const current = counter++
        map.set(current, promise.then(value => [ current, value ]))
    }
    for (; counter > 0; counter--) {
        const [ current, value ] = await Promise.race(map.values())
        yield value
        map.delete(current)
    }
}
