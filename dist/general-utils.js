// this file should have no runtime dependencies on node-only modules as some
// utils within are useful on both server and client. exclusively server-only
// utils should go in server-utils
import { error, ok } from 'fallible';
import { parse as secureJSONParse } from 'secure-json-parse';
export const CloseWebSocket = Symbol();
export function parseCookieHeader(header, name) {
    var _a;
    return (_a = header.match(`(?:^|; )${name}=([^;]*)`)) === null || _a === void 0 ? void 0 : _a[1];
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
export function signedCookieHeader(name, cookie, keys) {
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
    var _a, _b, _c, _d, _e;
    if (!useXForwardedFor) {
        return (_a = message.connection.remoteAddress) !== null && _a !== void 0 ? _a : message.socket.remoteAddress;
    }
    return (_e = (_d = (_c = (_b = getMessageHeader(message, 'x-forwarded-for')) === null || _b === void 0 ? void 0 : _b.match(/^\s*([^\s]+)\s*(?:,|$)/)) === null || _c === void 0 ? void 0 : _c[1]) !== null && _d !== void 0 ? _d : message.connection.remoteAddress) !== null && _e !== void 0 ? _e : message.socket.remoteAddress;
}
export function getMessageMethod(message) {
    var _a, _b;
    return (_b = (_a = message.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()) !== null && _b !== void 0 ? _b : 'GET';
}
export function getMessageURL(message) {
    var _a;
    return (_a = message.url) !== null && _a !== void 0 ? _a : '/';
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
    var _a;
    const match = (_a = url.match(/#(.+)/)) === null || _a === void 0 ? void 0 : _a[1];
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
    var _a, _b;
    const token = (_b = (_a = header.match(/^Bearer (.+)/)) === null || _a === void 0 ? void 0 : _a[1]) === null || _b === void 0 ? void 0 : _b.trim();
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