// This file should have no runtime dependencies on Node modules as some utils
// within are useful on both server and client. Exclusively server-only utils
// should go in ./server-utils.ts


import type { IncomingHttpHeaders, IncomingMessage } from 'node:http'

import type {
    Cleanup,
    MessageHandlerResult,
    WebSocketBody,
    WebsocketResponse
} from './types.js'


export { parse as parseJSONString } from 'secure-json-parse'


export const enum WebSocketReadyState {
    Connecting,
    Open,
    Closing,
    Closed
}


export interface IncomingMessageIPFields {
    headers: IncomingMessage['headers']
    socket: Pick<IncomingMessage['socket'], 'remoteAddress'>
}


/**
 * Attempts to return the IP of the client the message represents.
 *
 * @param useXForwardedFor
 * If `true`, the `'X-Forwarded-For'` header is respected. Defaults to `false`.
 */
export function getMessageIP(
    message: IncomingMessageIPFields,
    useXForwardedFor = false
): string | undefined {
    if (!useXForwardedFor) {
        return message.socket.remoteAddress
    }
    let header = message.headers['x-forwarded-for']
    if (Array.isArray(header)) {
        header = header[0]
    }
    return header?.match(/^\s*([^\s]+)\s*(?:,|$)/)?.[1] ?? message.socket.remoteAddress
}


export type ParsedContentType = {
    type: string
    characterSet?: string
}

/**
 * Parses the type and character set from a Content-Type header.
 * If the header has no `charset` directive, the entire header is returned.
 * Both type and characterSet are always returned lower case.
 */
export function parseCharSetContentTypeHeader(header: string): ParsedContentType | undefined {
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


/** Parses the integer value of a Content-Length header */
export function parseContentLengthHeader(header: string): number | undefined {
    // Passing an all whitespace string to Number gives you 0
    if (!header.match(/[0-9]/)) {
        return
    }
    const length = Number(header)
    if (!Number.isSafeInteger(length)) {
        return
    }
    return length
}


/** Parses the token from a Authorization header with the Bearer scheme */
export function parseAuthorizationHeaderBearer(header: string): string | undefined {
    // See: https://datatracker.ietf.org/doc/html/rfc6750#section-2.1
    return header.match(/^Bearer ([a-zA-Z0-9\-\._\~\+\/]+)/)?.[1]
}


type WebSocketHeaders = Pick<IncomingHttpHeaders, 'connection' | 'upgrade' | 'sec-websocket-key' | 'sec-websocket-version'>

/**
 * Returns whether all the headers required for a WebSocket upgrade are present.
 * Does not guarantee that those headers are fully valid - currently this can
 * only be confirmed by returning a {@link websocketResponse} from a handler.
 */
export function headersIndicateWebSocketRequest(headers: WebSocketHeaders): boolean {
    return headers.connection?.toLowerCase() === 'upgrade'
        && headers.upgrade === 'websocket'
        && headers['sec-websocket-key'] !== undefined
        && headers['sec-websocket-version'] !== undefined
}


export function response<T extends void>(state?: T): MessageHandlerResult<T>
export function response<T>(state: T, cleanup?: Cleanup): MessageHandlerResult<T>
export function response<T>(state: T, cleanup?: Cleanup): MessageHandlerResult<T> {
    return { state, cleanup }
}


export function websocketResponse(body: WebSocketBody, cleanup?: Cleanup): MessageHandlerResult<WebsocketResponse> {
    return response({ body }, cleanup)
}


/** Yields values from an iterable of promises as they resolve */
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
