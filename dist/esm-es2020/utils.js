export function getMessageCookie(message, name) {
    return message.headers.cookie?.match(`(?:^|; )${name}=([^;]*)`)?.[1];
}
function joinCookieValue(name, value) {
    return `${name}=${value}`;
}
function cookieSignatureName(name) {
    return `${name}.sig`;
}
export function getSignedMessageCookie(message, name, keys) {
    const value = getMessageCookie(message, name);
    if (value === undefined) {
        return;
    }
    const signature = getMessageCookie(message, cookieSignatureName(name));
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
function parseURLQueryString(queryString) {
    if (queryString === undefined) {
        return {};
    }
    const query = {};
    for (const pair of queryString.split('&')) {
        let [key, value] = pair.split('=');
        if (value === undefined) {
            continue;
        }
        key = decodeURIComponent(key);
        value = decodeURIComponent(value);
        query[key] = value;
    }
    return query;
}
function parseURLHash(hash) {
    if (hash === undefined) {
        return '';
    }
    return decodeURIComponent(hash);
}
function parseURLPathSegments(path) {
    const segments = [];
    for (let segment of path.split('/')) {
        segment = decodeURIComponent(segment);
        if (segment.length === 0) {
            continue;
        }
        segments.push(segment);
    }
    return segments;
}
export function parseMessageURL(message) {
    const url = getMessageURL(message);
    // this is actually faster than using .split()
    const match = /^(?:(.+)\?(.+)#(.+)|(.+)\?(.+)|(.+)#(.+))/.exec(url);
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
        };
}
export function parseMessageContentType(message) {
    let contentType = message.headers['content-type'];
    if (contentType === undefined) {
        return undefined;
    }
    const match = /^\s*(.+?)\s*;\s*charset\s*=\s*(")?(.+?)\2\s*$/i.exec(contentType);
    if (match === null) {
        contentType = contentType.trim();
        if (contentType.length === 0) {
            return undefined;
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