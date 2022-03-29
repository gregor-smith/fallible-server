// This file should have no runtime dependencies on Node modules as some utils
// within are useful on both server and client. Exclusively server-only utils
// should go in ./server-utils.ts
export { parse as parseJSONString } from 'secure-json-parse';
/**
 * Attempts to return the IP of the client the message represents.
 *
 * @param useXForwardedFor
 * If `true`, the `'X-Forwarded-For'` header is respected. Defaults to `false`.
 */
export function getMessageIP(message, useXForwardedFor = false) {
    if (!useXForwardedFor) {
        return message.socket.remoteAddress;
    }
    let header = message.headers['x-forwarded-for'];
    if (Array.isArray(header)) {
        header = header[0];
    }
    return header?.match(/^\s*([^\s]+)\s*(?:,|$)/)?.[1] ?? message.socket.remoteAddress;
}
/**
 * Parses the type and character set from a Content-Type header.
 * If the header has no `charset` directive, the entire header is returned.
 * Both type and characterSet are always returned lower case.
 */
export function parseCharSetContentTypeHeader(header) {
    const match = header.match(/^\s*(.+?)\s*;\s*charset\s*=\s*(")?(.+?)\2\s*$/i);
    if (match === null) {
        header = header.trim();
        if (header.length === 0) {
            return;
        }
        return {
            type: header.toLowerCase()
        };
    }
    const [, type, , characterSet] = match;
    return {
        type: type.toLowerCase(),
        characterSet: characterSet.toLowerCase()
    };
}
/** Parses the integer value of a Content-Length header */
export function parseContentLengthHeader(header) {
    // Passing an all whitespace string to Number gives you 0
    if (!header.match(/[0-9]/)) {
        return;
    }
    const length = Number(header);
    if (!Number.isSafeInteger(length)) {
        return;
    }
    return length;
}
/** Parses the token from a Authorization header with the Bearer scheme */
export function parseAuthorizationHeaderBearer(header) {
    // See: https://datatracker.ietf.org/doc/html/rfc6750#section-2.1
    return header.match(/^Bearer ([a-zA-Z0-9\-\._\~\+\/]+)/)?.[1];
}
/**
 * Returns whether all the headers required for a WebSocket upgrade are present.
 * Does not guarantee that those headers are fully valid - currently this can
 * only be confirmed by returning a {@link websocketResponse} from a handler.
 */
export function headersIndicateWebSocketRequest(headers) {
    return headers.connection?.toLowerCase() === 'upgrade'
        && headers.upgrade === 'websocket'
        && headers['sec-websocket-key'] !== undefined
        && headers['sec-websocket-version'] !== undefined;
}
export function response(state, cleanup) {
    return { state, cleanup };
}
export function websocketResponse(body, cleanup) {
    return response({ body }, cleanup);
}
/** Yields values from an iterable of promises as they resolve */
export async function* iterateAsResolved(promises) {
    const map = new Map();
    let counter = 0;
    for (const promise of promises) {
        const current = counter++;
        map.set(current, promise.then(value => [current, value]));
    }
    for (; counter > 0; counter--) {
        const [current, value] = await Promise.race(map.values());
        yield value;
        map.delete(current);
    }
}
//# sourceMappingURL=general-utils.js.map