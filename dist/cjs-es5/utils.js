"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageIsWebSocketRequest = exports.parseMessageAuthorizationHeaderBearer = exports.parseAuthorizationHeaderBearer = exports.parseMessageContentLength = exports.parseContentLengthHeader = exports.parseMessageContentType = exports.parseContentTypeHeader = exports.parseURLPath = exports.parseURLHash = exports.parseURLQueryString = exports.getMessageURL = exports.getMessageMethod = exports.getMessageIP = exports.getMessageHeader = exports.signedCookieHeader = exports.cookieHeader = exports.parseSignedMessageCookie = exports.parseMessageCookie = exports.parseCookieHeader = exports.CloseWebSocket = void 0;
var tslib_1 = require("tslib");
var fallible_1 = require("fallible");
exports.CloseWebSocket = Symbol();
function parseCookieHeader(header, name) {
    var _a;
    return (_a = header.match("(?:^|; )" + name + "=([^;]*)")) === null || _a === void 0 ? void 0 : _a[1];
}
exports.parseCookieHeader = parseCookieHeader;
function parseMessageCookie(message, name) {
    if (message.headers.cookie === undefined) {
        return;
    }
    return parseCookieHeader(message.headers.cookie, name);
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
        for (var _b = tslib_1.__values(matches), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = tslib_1.__read(_c.value, 1), segment = _d[0];
            segment = decodeURIComponent(segment);
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
exports.parseURLPath = parseURLPath;
function parseContentTypeHeader(header) {
    var match = header.match(/^\s*(.+?)\s*;\s*charset\s*=\s*(")?(.+?)\2\s*$/i);
    if (match === null) {
        header = header.trim();
        if (header.length === 0) {
            return;
        }
        return {
            type: header.toLowerCase()
        };
    }
    var _a = tslib_1.__read(match, 4), type = _a[1], characterSet = _a[3];
    return {
        type: type.toLowerCase(),
        characterSet: characterSet.toLowerCase()
    };
}
exports.parseContentTypeHeader = parseContentTypeHeader;
function parseMessageContentType(message) {
    var contentType = message.headers['content-type'];
    if (contentType === undefined) {
        return;
    }
    return parseContentTypeHeader(contentType);
}
exports.parseMessageContentType = parseMessageContentType;
function parseContentLengthHeader(header) {
    // today i learnt passing an all whitespace string to Number gives you 0
    // to what end?
    if (!header.match(/[0-9]/)) {
        return;
    }
    var length = Number(header);
    if (!Number.isSafeInteger(length)) {
        return;
    }
    return length;
}
exports.parseContentLengthHeader = parseContentLengthHeader;
function parseMessageContentLength(message) {
    var header = message.headers['content-length'];
    if (header === undefined) {
        return;
    }
    return parseContentLengthHeader(header);
}
exports.parseMessageContentLength = parseMessageContentLength;
function parseAuthorizationHeaderBearer(header) {
    var _a, _b;
    var token = (_b = (_a = header.match(/^Bearer (.+)/)) === null || _a === void 0 ? void 0 : _a[1]) === null || _b === void 0 ? void 0 : _b.trim();
    if (token === undefined || token.length === 0) {
        return;
    }
    return token;
}
exports.parseAuthorizationHeaderBearer = parseAuthorizationHeaderBearer;
function parseMessageAuthorizationHeaderBearer(message) {
    var header = getMessageHeader(message, 'authorization');
    if (header === undefined) {
        return fallible_1.error('Missing');
    }
    var token = parseAuthorizationHeaderBearer(header);
    return token === undefined
        ? fallible_1.error('Invalid')
        : fallible_1.ok(token);
}
exports.parseMessageAuthorizationHeaderBearer = parseMessageAuthorizationHeaderBearer;
function messageIsWebSocketRequest(message) {
    return getMessageHeader(message, 'upgrade') === 'websocket';
}
exports.messageIsWebSocketRequest = messageIsWebSocketRequest;
//# sourceMappingURL=utils.js.map