"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMessageContentLength = exports.parseMessageContentType = exports.parseMessageURL = exports.getMessageURL = exports.getMessageMethod = exports.getMessageIP = exports.getMessageHeader = exports.signedCookieHeader = exports.cookieHeader = exports.getSignedMessageCookie = exports.getMessageCookie = void 0;
var tslib_1 = require("tslib");
function getMessageCookie(message, name) {
    var _a, _b;
    return (_b = (_a = message.headers.cookie) === null || _a === void 0 ? void 0 : _a.match("(?:^|; )" + name + "=([^;]*)")) === null || _b === void 0 ? void 0 : _b[1];
}
exports.getMessageCookie = getMessageCookie;
function joinCookieValue(name, value) {
    return name + "=" + value;
}
function cookieSignatureName(name) {
    return name + ".sig";
}
function getSignedMessageCookie(message, name, keys) {
    var value = getMessageCookie(message, name);
    if (value === undefined) {
        return;
    }
    var signature = getMessageCookie(message, cookieSignatureName(name));
    if (signature === undefined) {
        return;
    }
    if (!keys.verify(joinCookieValue(name, value), signature)) {
        return;
    }
    return value;
}
exports.getSignedMessageCookie = getSignedMessageCookie;
function cookieHeader(name, _a) {
    var value = _a.value, path = _a.path, maxAge = _a.maxAge, domain = _a.domain, sameSite = _a.sameSite, _b = _a.secure, secure = _b === void 0 ? false : _b, _c = _a.httpOnly, httpOnly = _c === void 0 ? false : _c;
    var segments = [joinCookieValue(name, value)];
    if (path !== undefined) {
        segments.push("Path=" + path);
    }
    if (maxAge !== undefined) {
        segments.push("Max-Age=" + maxAge);
    }
    if (domain !== undefined) {
        segments.push("Domain=" + domain);
    }
    if (sameSite !== undefined) {
        segments.push("SameSite=" + sameSite);
    }
    if (secure) {
        segments.push('Secure');
    }
    if (httpOnly) {
        segments.push('HttpOnly');
    }
    return segments.join('; ');
}
exports.cookieHeader = cookieHeader;
function signedCookieHeader(name, cookie, keys) {
    return cookieHeader(cookieSignatureName(name), tslib_1.__assign(tslib_1.__assign({}, cookie), { value: keys.sign(joinCookieValue(name, cookie.value)) }));
}
exports.signedCookieHeader = signedCookieHeader;
function getMessageHeader(message, name) {
    var header = message.headers[name];
    return Array.isArray(header)
        ? header[0]
        : header;
}
exports.getMessageHeader = getMessageHeader;
function getMessageIP(message, useXForwardedFor) {
    var _a, _b, _c, _d, _e;
    if (useXForwardedFor === void 0) { useXForwardedFor = false; }
    if (!useXForwardedFor) {
        return (_a = message.connection.remoteAddress) !== null && _a !== void 0 ? _a : message.socket.remoteAddress;
    }
    return (_e = (_d = (_c = (_b = getMessageHeader(message, 'x-forwarded-for')) === null || _b === void 0 ? void 0 : _b.match(/^\s*([^\s]+)\s*(?:,|$)/)) === null || _c === void 0 ? void 0 : _c[1]) !== null && _d !== void 0 ? _d : message.connection.remoteAddress) !== null && _e !== void 0 ? _e : message.socket.remoteAddress;
}
exports.getMessageIP = getMessageIP;
function getMessageMethod(message) {
    var _a, _b;
    return (_b = (_a = message.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()) !== null && _b !== void 0 ? _b : 'GET';
}
exports.getMessageMethod = getMessageMethod;
function getMessageURL(message) {
    var _a;
    return (_a = message.url) !== null && _a !== void 0 ? _a : '/';
}
exports.getMessageURL = getMessageURL;
function parseURLQueryString(queryString) {
    var e_1, _a;
    if (queryString === undefined) {
        return {};
    }
    var query = {};
    try {
        for (var _b = tslib_1.__values(queryString.split('&')), _c = _b.next(); !_c.done; _c = _b.next()) {
            var pair = _c.value;
            var _d = tslib_1.__read(pair.split('='), 2), key = _d[0], value = _d[1];
            if (value === undefined) {
                continue;
            }
            key = decodeURIComponent(key);
            value = decodeURIComponent(value);
            query[key] = value;
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
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
    var e_2, _a;
    var segments = [];
    try {
        for (var _b = tslib_1.__values(path.split('/')), _c = _b.next(); !_c.done; _c = _b.next()) {
            var segment = _c.value;
            segment = decodeURIComponent(segment);
            if (segment.length === 0) {
                continue;
            }
            segments.push(segment);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return segments;
}
function parseMessageURL(message) {
    var _a, _b, _c, _d, _e;
    var url = getMessageURL(message);
    // this is actually faster than using .split()
    var match = /^(?:(.+)\?(.+)#(.+)|(.+)\?(.+)|(.+)#(.+))/.exec(url);
    return match === null
        ? {
            path: parseURLPathSegments(url),
            query: {},
            hash: ''
        }
        : {
            path: parseURLPathSegments((_c = (_b = (_a = match[6]) !== null && _a !== void 0 ? _a : match[4]) !== null && _b !== void 0 ? _b : match[1]) !== null && _c !== void 0 ? _c : url),
            query: parseURLQueryString((_d = match[5]) !== null && _d !== void 0 ? _d : match[2]),
            hash: parseURLHash((_e = match[7]) !== null && _e !== void 0 ? _e : match[3])
        };
}
exports.parseMessageURL = parseMessageURL;
function parseMessageContentType(message) {
    var contentType = message.headers['content-type'];
    if (contentType === undefined) {
        return undefined;
    }
    var match = /^\s*(.+?)\s*;\s*charset\s*=\s*(")?(.+?)\2\s*$/i.exec(contentType);
    if (match === null) {
        contentType = contentType.trim();
        if (contentType.length === 0) {
            return undefined;
        }
        return {
            type: contentType.toLowerCase()
        };
    }
    var _a = tslib_1.__read(match, 4), type = _a[1], characterSet = _a[3];
    return {
        type: type.toLowerCase(),
        characterSet: characterSet.toLowerCase()
    };
}
exports.parseMessageContentType = parseMessageContentType;
function parseMessageContentLength(message) {
    var header = message.headers['content-length'];
    // today i learnt passing an all whitespace string to Number gives you 0
    // to what end?
    if (!(header === null || header === void 0 ? void 0 : header.match(/[0-9]/))) {
        return;
    }
    var length = Number(header);
    if (!Number.isSafeInteger(length)) {
        return;
    }
    return length;
}
exports.parseMessageContentLength = parseMessageContentLength;
//# sourceMappingURL=utils.js.map