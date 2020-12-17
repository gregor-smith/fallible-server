import type { IncomingMessage } from 'http'

import type Keygrip from 'keygrip'

import type { Cookie, Method, ParsedContentType } from './types'


export const CloseWebSocket = Symbol()


export function parseMessageCookie(
    message: Pick<IncomingMessage, 'headers'>,
    name: string
): string | undefined {
    return message.headers.cookie?.match(`(?:^|; )${name}=([^;]*)`)?.[1]
}


function joinCookieValue(name: string, value: string): string {
    return `${name}=${value}`
}


function cookieSignatureName(name: string): string {
    return `${name}.sig`
}


export function parseSignedMessageCookie(
    message: Pick<IncomingMessage, 'headers'>,
    name: string,
    keys: Pick<Keygrip, 'verify'>
): string | undefined {
    const value = parseMessageCookie(message, name)
    if (value === undefined) {
        return
    }
    const signature = parseMessageCookie(message, cookieSignatureName(name))
    if (signature === undefined) {
        return
    }
    if (!keys.verify(joinCookieValue(name, value), signature)) {
        return
    }
    return value
}


export function cookieHeader(
    name: string,
    { value, path, maxAge, domain, sameSite, secure = false, httpOnly = false }: Readonly<Cookie>
): string {
    const segments = [ joinCookieValue(name, value) ]
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
        cookieSignatureName(name),
        {
            ...cookie,
            value: keys.sign(
                joinCookieValue(name, cookie.value)
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


export function parseURLQueryString(
    url: string,
    { skipEmptyValues = true, skipMissingValues = true } = {}
): Partial<Record<string, string>> {
    const query: Partial<Record<string, string>> = {}
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


export function parseMessageContentType(message: Pick<IncomingMessage, 'headers'>): ParsedContentType | undefined {
    let contentType = message.headers['content-type']
    if (contentType === undefined) {
        return
    }

    const match = contentType.match(/^\s*(.+?)\s*;\s*charset\s*=\s*(")?(.+?)\2\s*$/i)
    if (match === null) {
        contentType = contentType.trim()
        if (contentType.length === 0) {
            return
        }
        return {
            type: contentType.toLowerCase()
        }
    }

    const [ , type, , characterSet ] = match as [ unknown, string, unknown, string ]
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
