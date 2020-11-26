export function parseMessageCookie(message, name) {
    return message.headers.cookie?.match(`(?:^|; )${name}=([^;]*)`)?.[1];
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
export function parseMessageContentType(message) {
    let contentType = message.headers['content-type'];
    if (contentType === undefined) {
        return;
    }
    const match = contentType.match(/^\s*(.+?)\s*;\s*charset\s*=\s*(")?(.+?)\2\s*$/i);
    if (match === null) {
        contentType = contentType.trim();
        if (contentType.length === 0) {
            return;
        }
        return {
            type: contentType.toLowerCase()
        };
    }
    const [, type, , characterSet] = match;
    return {
        type: type.toLowerCase(),
        characterSet: characterSet.toLowerCase()
    };
}
export function parseMessageContentLength(message) {
    const header = message.headers['content-length'];
    // today i learnt passing an all whitespace string to Number gives you 0
    // to what end?
    if (!header?.match(/[0-9]/)) {
        return;
    }
    const length = Number(header);
    if (!Number.isSafeInteger(length)) {
        return;
    }
    return length;
}
//# sourceMappingURL=utils.js.map