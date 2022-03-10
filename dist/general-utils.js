// This file should have no runtime dependencies on Node modules as some utils
// within are useful on both server and client. Exclusively server-only utils
// should go in ./server-utils.ts
import { error, ok } from 'fallible';
export { parse as parseJSONString } from 'secure-json-parse';
export function contentDispositionHeader(type, filename) {
    if (type === 'inline') {
        return type;
    }
    if (filename !== undefined) {
        type = `${type}; filename="${encodeURIComponent(filename)}"`;
    }
    return type;
}
export function parseCookieHeader(header, name) {
    // TODO: allow double quoted values (see https://datatracker.ietf.org/doc/html/rfc6265#section-4.1.1)
    // TODO: disallow ascii control codes (see https://jkorpela.fi/chars/c0.html)
    // TODO: check name is valid cookie (see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes)
    return header.match(`(?:^|; )${name}=([^;]*)`)?.[1];
}
export function parseMessageCookie(message, name) {
    if (message.headers.cookie === undefined) {
        return;
    }
    return parseCookieHeader(message.headers.cookie, name);
}
function cookieKeyValuePair(name, value) {
    return `${name}=${value}`;
}
export function signatureCookieName(name) {
    return `${name}.sig`;
}
export function parseSignedMessageCookie(message, name, keys) {
    const value = parseMessageCookie(message, name);
    if (value === undefined) {
        return error('ValueCookieMissing');
    }
    const signature = parseMessageCookie(message, signatureCookieName(name));
    if (signature === undefined) {
        return error('SignatureCookieMissing');
    }
    if (!keys.verify(cookieKeyValuePair(name, value), signature)) {
        return error('SignatureInvalid');
    }
    return ok(value);
}
export function cookieHeader(name, { value, path, maxAge, domain, sameSite, secure = false, httpOnly = false }) {
    const segments = [cookieKeyValuePair(name, value)];
    if (path !== undefined) {
        segments.push(`Path=${path}`);
    }
    if (maxAge !== undefined) {
        segments.push(`Max-Age=${maxAge}`);
    }
    if (domain !== undefined) {
        segments.push(`Domain=${domain}`);
    }
    if (sameSite !== undefined) {
        segments.push(`SameSite=${sameSite}`);
    }
    if (secure) {
        segments.push('Secure');
    }
    if (httpOnly) {
        segments.push('HttpOnly');
    }
    return segments.join('; ');
}
export function cookieSignatureHeader(name, cookie, keys) {
    return cookieHeader(signatureCookieName(name), {
        ...cookie,
        value: keys.sign(cookieKeyValuePair(name, cookie.value))
    });
}
export function getMessageHeader(message, name) {
    const header = message.headers[name];
    return Array.isArray(header)
        ? header[0]
        : header;
}
export function getMessageIP(message, useXForwardedFor = false) {
    if (!useXForwardedFor) {
        return message.socket.remoteAddress;
    }
    return getMessageHeader(message, 'x-forwarded-for')
        ?.match(/^\s*([^\s]+)\s*(?:,|$)/)?.[1]
        ?? message.socket.remoteAddress;
}
export function getMessageMethod(message) {
    return message.method?.toUpperCase() ?? 'GET';
}
export function getMessageURL(message) {
    return message.url ?? '/';
}
export function parseURLQueryString(url, { skipEmptyValues = true, skipMissingValues = true } = {}) {
    const query = {};
    const matches = url.matchAll(/[\?&]([^\?&#=]+)(?:=([^\?&#]*))?(?=$|[\?&#])/g);
    for (let [, key, value] of matches) {
        if (value === undefined) {
            if (skipMissingValues) {
                continue;
            }
            value = '';
        }
        else if (value.length === 0 && skipEmptyValues) {
            continue;
        }
        else {
            value = decodeURIComponent(value);
        }
        key = decodeURIComponent(key);
        query[key] = value;
    }
    return query;
}
export function joinURLQueryString(query) {
    const pairs = [];
    for (let [key, value] of Object.entries(query)) {
        if (value === undefined) {
            continue;
        }
        key = encodeURIComponent(key);
        value = encodeURIComponent(String(value));
        pairs.push(`${key}=${value}`);
    }
    return pairs.length === 0
        ? ''
        : ('?' + pairs.join('&'));
}
export function parseURLHash(url) {
    const match = url.match(/#(.+)/)?.[1];
    return match === undefined
        ? ''
        : decodeURIComponent(match);
}
function joinURLPathSegments(segments) {
    return '/' + segments.join('/');
}
export function parseURLPath(url) {
    const segments = [...parseURLPathSegments(url)];
    return joinURLPathSegments(segments);
}
export function* parseURLPathSegments(url) {
    for (const [segment] of url.matchAll(/(?<=\/)[^\/\?#]+/g)) {
        yield decodeURIComponent(segment);
    }
}
export class URLParser {
    full;
    #hash;
    #path;
    #segments;
    #query;
    constructor(full) {
        this.full = full;
    }
    hash() {
        return this.#hash ??= parseURLHash(this.full);
    }
    path() {
        return this.#path ??= joinURLPathSegments(this.segments());
    }
    segments() {
        return this.#segments ??= [...parseURLPathSegments(this.full)];
    }
    query() {
        return this.#query ??= parseURLQueryString(this.full);
    }
}
export function parseContentTypeHeader(header) {
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
export function parseMessageContentType(message) {
    let contentType = message.headers['content-type'];
    if (contentType === undefined) {
        return;
    }
    return parseContentTypeHeader(contentType);
}
export function parseContentLengthHeader(header) {
    // today i learnt passing an all whitespace string to Number gives you 0
    // to what end?
    if (!header.match(/[0-9]/)) {
        return;
    }
    const length = Number(header);
    if (!Number.isSafeInteger(length)) {
        return;
    }
    return length;
}
export function parseMessageContentLength(message) {
    const header = message.headers['content-length'];
    if (header === undefined) {
        return;
    }
    return parseContentLengthHeader(header);
}
export function parseAuthorizationHeaderBearer(header) {
    // See: https://datatracker.ietf.org/doc/html/rfc6750#section-2.1
    return header.match(/^Bearer ([a-zA-Z0-9\-\._\~\+\/]+)/)?.[1];
}
export function parseMessageAuthorizationHeaderBearer(message) {
    if (message.headers.authorization === undefined) {
        return error('Missing');
    }
    const token = parseAuthorizationHeaderBearer(message.headers.authorization);
    return token === undefined
        ? error('Invalid')
        : ok(token);
}
export function messageIsWebSocketRequest(message) {
    return message.headers.connection?.toLowerCase() === 'upgrade'
        && message.headers.upgrade === 'websocket';
}
export function response(state, cleanup) {
    return { state, cleanup };
}
export function websocketResponse(body, cleanup) {
    return response({ body }, cleanup);
}
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