"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cookieToSignedHeaders = exports.cookieToHeader = exports.parseMessageContentLength = exports.parseMessageContentType = exports.parseMessageURL = exports.getMessageURL = exports.getMessageMethod = exports.getMessageIP = exports.getMessageHeader = exports.getMessageSignedCookie = exports.getMessageCookie = void 0;
var tslib_1 = require("tslib");
var js_base64_1 = tslib_1.__importDefault(require("js-base64"));
function getMessageCookie(message, name) {
    var _a;
    var header = message.headers['cookie'];
    if (header === undefined) {
        return;
    }
    name = js_base64_1.default.encodeURI(name);
    var value = (_a = new RegExp("(?:^|; )" + name + "=([^;]*)")
        .exec(header)) === null || _a === void 0 ? void 0 : _a[1];
    if (value === undefined) {
        return;
    }
    return js_base64_1.default.decode(value);
}
exports.getMessageCookie = getMessageCookie;
function joinCookieValue(name, value) {
    return name + "=" + value;
}
function cookieSignatureName(name) {
    return name + ".sig";
}
function getMessageSignedCookie(message, name, keys) {
    var signature = getMessageCookie(message, cookieSignatureName(name));
    if (signature === undefined) {
        return;
    }
    var value = getMessageCookie(message, name);
    if (value === undefined) {
        return;
    }
    if (!keys.verify(joinCookieValue(name, value), signature)) {
        return;
    }
    return value;
}
exports.getMessageSignedCookie = getMessageSignedCookie;
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
    var header = getMessageHeader(message, 'x-forwarded-for');
    return (_e = (_d = (_c = (_b = header === null || header === void 0 ? void 0 : header.match(/^\s*(.+?)\s*,/)) === null || _b === void 0 ? void 0 : _b[1]) !== null && _c !== void 0 ? _c : header === null || header === void 0 ? void 0 : header.trim()) !== null && _d !== void 0 ? _d : message.connection.remoteAddress) !== null && _e !== void 0 ? _e : message.socket.remoteAddress;
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
    var length = Number(message.headers['content-length']);
    return Number.isNaN(length) ? undefined : length;
}
exports.parseMessageContentLength = parseMessageContentLength;
function cookieToHeader(name, _a) {
    var value = _a.value, path = _a.path, expires = _a.expires, domain = _a.domain, sameSite = _a.sameSite, _b = _a.secure, secure = _b === void 0 ? false : _b, _c = _a.httpOnly, httpOnly = _c === void 0 ? false : _c;
    name = js_base64_1.default.encodeURI(name);
    value = js_base64_1.default.encodeURI(value);
    var segments = [joinCookieValue(name, value)];
    if (path !== undefined) {
        segments.push("Path=" + path);
    }
    if (expires !== undefined) {
        segments.push("Expires=" + expires.toUTCString());
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
exports.cookieToHeader = cookieToHeader;
function cookieToSignedHeaders(name, cookie, keys) {
    var header = cookieToHeader(name, cookie);
    var signature = cookieToHeader(cookieSignatureName(name), tslib_1.__assign(tslib_1.__assign({}, cookie), { value: keys.sign(joinCookieValue(name, cookie.value)) }));
    return [header, signature];
}
exports.cookieToSignedHeaders = cookieToSignedHeaders;
//# sourceMappingURL=utils.js.map