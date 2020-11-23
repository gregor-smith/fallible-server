import type { IncomingMessage } from 'http'

import Base64 from 'js-base64'
import type Keygrip from 'keygrip'

import type { Cookie, Method, ParsedContentType, ParsedURLPath } from './types'


export function getMessageCookie(
    message: Pick<IncomingMessage, 'headers'>,
    name: string
): string | undefined {
    const header = message.headers['cookie']
    if (header === undefined) {
        return
    }
    name = Base64.encodeURI(name)
    const value = new RegExp(`(?:^|; )${name}=([^;]*)`)
        .exec(header)
        ?.[1]
    if (value === undefined) {
        return
    }
    return Base64.decode(value)
}


function joinCookieValue(name: string, value: string): string {
    return `${name}=${value}`
}


function cookieSignatureName(name: string): string {
    return `${name}.sig`
}


export function getMessageSignedCookie(
    message: Pick<IncomingMessage, 'headers'>,
    name: string,
    keys: Pick<Keygrip, 'verify'>
): string | undefined {
    const signature = getMessageCookie(message, cookieSignatureName(name))
    if (signature === undefined) {
        return
    }
    const value = getMessageCookie(message, name)
    if (value === undefined) {
        return
    }
    if (!keys.verify(joinCookieValue(name, value), signature)) {
        return
    }
    return value
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
    connection: Pick<IncomingMessage['connection'], 'remoteAddress'>
    socket: Pick<IncomingMessage['socket'], 'remoteAddress'>
}


export function getMessageIP(
    message: IncomingMessageIPFields,
    useXForwardedFor = false
): string | undefined {
    if (!useXForwardedFor) {
        return message.connection.remoteAddress ?? message.socket.remoteAddress
    }
    return getMessageHeader(message, 'x-forwarded-for')
        ?.match(/^\s*([^\s]+)\s*(?:,|$)/)
        ?.[1]
        ?? message.connection.remoteAddress
        ?? message.socket.remoteAddress
}


export function getMessageMethod(message: Pick<IncomingMessage, 'method'>): Method {
    return message.method?.toUpperCase() as Method | undefined ?? 'GET'
}


export function getMessageURL(message: Pick<IncomingMessage, 'url'>): string {
    return message.url ?? '/'
}


function parseURLQueryString(queryString?: string): Partial<Record<string, string>> {
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


function parseURLHash(hash?: string): string {
    if (hash === undefined) {
        return ''
    }
    return decodeURIComponent(hash)
}


function parseURLPathSegments(path: string): string[] {
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


export function parseMessageURL(message: Pick<IncomingMessage, 'url'>): ParsedURLPath {
    const url = getMessageURL(message)

    // this is actually faster than using .split()
    const match: (string | undefined)[] | null = /^(?:(.+)\?(.+)#(.+)|(.+)\?(.+)|(.+)#(.+))/.exec(url)
    return match === null
        ? {
            path: parseURLPathSegments(url),
            query: {},
            hash: ''
        }
        : {
            path: parseURLPathSegments(match[6] ?? match[4] ?? match[1] ?? url),
            query: parseURLQueryString(match[5] ?? match[2]),
            hash: parseURLHash(match[7] ?? match[3])
        }
}


export function parseMessageContentType(message: Pick<IncomingMessage, 'headers'>): ParsedContentType | undefined {
    let contentType = message.headers['content-type']
    if (contentType === undefined) {
        return undefined
    }

    const match = /^\s*(.+?)\s*;\s*charset\s*=\s*(")?(.+?)\2\s*$/i.exec(contentType)
    if (match === null) {
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


export function parseMessageContentLength(message: Pick<IncomingMessage, 'headers'>): number | undefined {
    const header = message.headers['content-length']
    // today i learnt passing an all whitespace string to Number gives you 0
    // to what end?
    if (!header?.match(/[0-9]/)) {
        return
    }
    const length = Number(header)
    if (!Number.isSafeInteger(length)) {
        return
    }
    return length
}


export function cookieToHeader(
    name: string,
    { value, path, expires, domain, sameSite, secure = false, httpOnly = false }: Readonly<Cookie>
): string {
    name = Base64.encodeURI(name)
    value = Base64.encodeURI(value)
    const segments = [ joinCookieValue(name, value) ]
    if (path !== undefined) {
        segments.push(`Path=${path}`)
    }
    if (expires !== undefined) {
        segments.push(`Expires=${expires.toUTCString()}`)
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


export function cookieToSignedHeaders(
    name: string,
    cookie: Readonly<Cookie>,
    keys: Pick<Keygrip, 'sign'>
): [ cookie: string, signature: string ] {
    const header = cookieToHeader(name, cookie)
    const signature = cookieToHeader(
        cookieSignatureName(name),
        {
            ...cookie,
            value: keys.sign(
                joinCookieValue(name, cookie.value)
            )
        }
    )
    return [ header, signature ]
}
