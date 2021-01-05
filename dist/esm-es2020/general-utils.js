// this file should have no runtime dependencies on node-only modules as some
// utils within are useful on both server and client. exclusively server-only
// utils should go in server-utils
import { error, ok } from 'fallible';
import { parse as secureJSONParse } from 'secure-json-parse';
export const CloseWebSocket = Symbol();
export function parseCookieHeader(header, name) {
    return header.match(`(?:^|; )${name}=([^;]*)`)?.[1];
}
export function parseMessageCookie(message, name) {
    if (message.headers.cookie === undefined) {
        return;
    }
    return parseCookieHeader(message.headers.cookie, name);
}
function joinCookieValue(name, value) {
    return `${name}=${value}`;
}
function cookieSignatureName(name) {
    return `${name}.sig`;
}
export function parseSignedMessageCookie(message, name, keys) {
    const value = parseMessageCookie(message, name);
    if (value === undefined) {
        return;
    }
    const signature = parseMessageCookie(message, cookieSignatureName(name));
    if (signature === undefined) {
        return;
    }
    if (!keys.verify(joinCookieValue(name, value), signature)) {
        return;
    }
    return value;
}
export function cookieHeader(name, { value, path, maxAge, domain, sameSite, secure = false, httpOnly = false }) {
    const segments = [joinCookieValue(name, value)];
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
export function signedCookieHeader(name, cookie, keys) {
    return cookieHeader(cookieSignatureName(name), {
        ...cookie,
        value: keys.sign(joinCookieValue(name, cookie.value))
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
        return message.connection.remoteAddress ?? message.socket.remoteAddress;
    }
    return getMessageHeader(message, 'x-forwarded-for')
        ?.match(/^\s*([^\s]+)\s*(?:,|$)/)?.[1]
        ?? message.connection.remoteAddress
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
    for (const match of matches) {
        let [, key, value] = match;
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
export function parseURLHash(url) {
    const match = url.match(/#(.+)/)?.[1];
    return match === undefined
        ? ''
        : decodeURIComponent(match);
}
export function parseURLPath(url) {
    const segments = [];
    const matches = url.matchAll(/(?<=\/)[^\/\?#]+/g);
    for (let [segment] of matches) {
        segment = decodeURIComponent(segment);
        segments.push(segment);
    }
    return segments;
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
    const token = header.match(/^Bearer (.+)/)?.[1]
        ?.trim();
    if (token === undefined || token.length === 0) {
        return;
    }
    return token;
}
export function parseMessageAuthorizationHeaderBearer(message) {
    const header = getMessageHeader(message, 'authorization');
    if (header === undefined) {
        return error('Missing');
    }
    const token = parseAuthorizationHeaderBearer(header);
    return token === undefined
        ? error('Invalid')
        : ok(token);
}
export function messageIsWebSocketRequest(message) {
    return getMessageHeader(message, 'upgrade') === 'websocket';
}
export function parseJSONString(string) {
    let json;
    try {
        json = secureJSONParse(string);
    }
    catch {
        return error();
    }
    return ok(json);
}
//# sourceMappingURL=general-utils.js.map