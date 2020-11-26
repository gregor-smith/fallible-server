"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMessageContentLength = exports.parseMessageContentType = exports.parseURLPath = exports.parseURLHash = exports.parseURLQueryString = exports.getMessageURL = exports.getMessageMethod = exports.getMessageIP = exports.getMessageHeader = exports.signedCookieHeader = exports.cookieHeader = exports.parseSignedMessageCookie = exports.parseMessageCookie = void 0;
var tslib_1 = require("tslib");
function parseMessageCookie(message, name) {
    var _a, _b;
    return (_b = (_a = message.headers.cookie) === null || _a === void 0 ? void 0 : _a.match("(?:^|; )" + name + "=([^;]*)")) === null || _b === void 0 ? void 0 : _b[1];
}
exports.parseMessageCookie = parseMessageCookie;
function joinCookieValue(name, value) {
    return name + "=" + value;
}
function cookieSignatureName(name) {
    return name + ".sig";
}
function parseSignedMessageCookie(message, name, keys) {
    var value = parseMessageCookie(message, name);
    if (value === undefined) {
        return;
    }
    var signature = parseMessageCookie(message, cookieSignatureName(name));
    if (signature === undefined) {
        return;
    }
    if (!keys.verify(joinCookieValue(name, value), signature)) {
        return;
    }
    return value;
}
exports.parseSignedMessageCookie = parseSignedMessageCookie;
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
function parseURLQueryString(url, _a) {
    var e_1, _b;
    var _c = _a === void 0 ? {} : _a, _d = _c.skipEmptyValues, skipEmptyValues = _d === void 0 ? true : _d, _e = _c.skipMissingValues, skipMissingValues = _e === void 0 ? true : _e;
    var query = {};
    var matches = url.matchAll(/[\?&]([^\?&#=]+)(?:=([^\?&#]*))?(?=$|[\?&#])/g);
    try {
        for (var matches_1 = tslib_1.__values(matches), matches_1_1 = matches_1.next(); !matches_1_1.done; matches_1_1 = matches_1.next()) {
            var match = matches_1_1.value;
            var _f = tslib_1.__read(match, 3), key = _f[1], value = _f[2];
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
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (matches_1_1 && !matches_1_1.done && (_b = matches_1.return)) _b.call(matches_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return query;
}
exports.parseURLQueryString = parseURLQueryString;
function parseURLHash(url) {
    var _a;
    var match = (_a = url.match(/#(.+)/)) === null || _a === void 0 ? void 0 : _a[1];
    return match === undefined
        ? ''
        : decodeURIComponent(match);
}
exports.parseURLHash = parseURLHash;
function parseURLPath(url) {
    var e_2, _a;
    var segments = [];
    var matches = url.matchAll(/(?<=\/)[^\/\?#]+/g);
    try {
        for (var matches_2 = tslib_1.__values(matches), matches_2_1 = matches_2.next(); !matches_2_1.done; matches_2_1 = matches_2.next()) {
            var _b = tslib_1.__read(matches_2_1.value, 1), segment = _b[0];
            segment = decodeURIComponent(segment);
            segments.push(segment);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (matches_2_1 && !matches_2_1.done && (_a = matches_2.return)) _a.call(matches_2);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return segments;
}
exports.parseURLPath = parseURLPath;
function parseMessageContentType(message) {
    var contentType = message.headers['content-type'];
    if (contentType === undefined) {
        return;
    }
    var match = contentType.match(/^\s*(.+?)\s*;\s*charset\s*=\s*(")?(.+?)\2\s*$/i);
    if (match === null) {
        contentType = contentType.trim();
        if (contentType.length === 0) {
            return;
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