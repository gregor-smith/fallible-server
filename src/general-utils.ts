// this file should have no runtime dependencies on node-only modules as some
// utils within are useful on both server and client. exclusively server-only
// utils should go in server-utils

import type { IncomingMessage } from 'http'

import type Keygrip from 'keygrip'
import { error, ok, Result } from 'fallible'
import { parse as secureJSONParse } from 'secure-json-parse'

import type { Cookie, Formattable, Method, ParsedContentType } from './types.js'


export const CloseWebSocket = Symbol()


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
) {
    return `${name}=${value}` as const
}


export function signatureCookieName<T extends Formattable>(name: T) {
    return `${name}.sig` as const
}


export type ParseSignedMessageCookieError =
    | 'ValueCookieMissing'
    | 'SignatureCookieMissing'
    | 'SignatureInvalid'


export function parseSignedMessageCookie(
    message: Pick<IncomingMessage, 'headers'>,
    name: string,
    keys: Pick<Keygrip, 'verify'>
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
    for (const match of matches) {
        let [ , key, value ] = match as [ unknown, string, string | undefined ]
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


export function parseURLPath(url: string): string[] {
    const segments: string[] = []
    const matches = url.matchAll(/(?<=\/)[^\/\?#]+/g)
    for (let [ segment ] of matches as Iterable<[ string ]>) {
        segment = decodeURIComponent(segment)
        segments.push(segment)
    }
    return segments
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
    const token = header.match(/^Bearer (.+)/)
        ?.[1]
        ?.trim()
    if (token === undefined || token.length === 0) {
        return
    }
    return token
}


export type ParseMessageAuthorisationBearerError =
    | 'Missing'
    | 'Invalid'


export function parseMessageAuthorizationHeaderBearer(
    message: Pick<IncomingMessage, 'headers'>
): Result<string, ParseMessageAuthorisationBearerError> {
    const header = getMessageHeader(message, 'authorization')
    if (header === undefined) {
        return error('Missing' as const)
    }
    const token = parseAuthorizationHeaderBearer(header)
    return token === undefined
        ? error('Invalid' as const)
        : ok(token)
}


export function messageIsWebSocketRequest(message: Pick<IncomingMessage, 'headers'>): boolean {
    return getMessageHeader(message, 'upgrade') === 'websocket'
}


export function parseJSONString<T = unknown>(string: string): Result<T, void> {
    let json: T
    try {
        json = secureJSONParse(string)
    }
    catch {
        return error()
    }
    return ok(json)
}
