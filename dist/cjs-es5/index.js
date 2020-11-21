"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRequestListener = exports.Request = void 0;
var tslib_1 = require("tslib");
var url_parse_1 = tslib_1.__importDefault(require("url-parse"));
var cookies_1 = tslib_1.__importDefault(require("cookies"));
var fallible_1 = require("fallible");
var Request = /** @class */ (function () {
    function Request(_a) {
        var getCookie = _a.getCookie, behindProxy = _a.behindProxy, ip = _a.ip, method = _a.method, headers = _a.headers, url = _a.url;
        this.cookie = getCookie;
        this.behindProxy = behindProxy;
        this._ip = ip;
        this.method = method;
        this.headers = headers;
        this.url = url;
    }
    Request.prototype.header = function (key) {
        var header = this.headers[key];
        return Array.isArray(header)
            ? header[0]
            : header;
    };
    Object.defineProperty(Request.prototype, "parsedContentType", {
        get: function () {
            var _a, _b;
            if (this._parsedContentType === undefined) {
                var match = (_a = this.headers['content-type']) === null || _a === void 0 ? void 0 : _a.match(/^\s*(?:(.+?)\s*;\s*charset="?(.+?)"?|(.+))\s*$/);
                if (match === null || match === undefined) {
                    return undefined;
                }
                var _c = tslib_1.__read(match, 4), type = _c[1], characterSet = _c[2], full = _c[3];
                this._parsedContentType = {
                    type: (_b = type === null || type === void 0 ? void 0 : type.toLowerCase()) !== null && _b !== void 0 ? _b : full.toLowerCase(),
                    characterSet: characterSet === null || characterSet === void 0 ? void 0 : characterSet.toLowerCase()
                };
            }
            return this._parsedContentType;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Request.prototype, "parsedURL", {
        get: function () {
            var e_1, _a;
            if (this._parsedURL === undefined) {
                var _b = url_parse_1.default(this.url, true), protocol = _b.protocol, host = _b.host, pathname = _b.pathname, query = _b.query, hash = _b.hash;
                var path = [];
                try {
                    for (var _c = tslib_1.__values(pathname.split('/')), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var segment = _d.value;
                        var decoded = decodeURIComponent(segment).trim();
                        if (decoded.length === 0) {
                            continue;
                        }
                        path.push(decoded);
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                this._parsedURL = {
                    protocol: protocol,
                    host: host,
                    path: path,
                    query: query,
                    hash: hash.slice(1)
                };
            }
            return this._parsedURL;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Request.prototype, "protocol", {
        get: function () {
            var _a;
            if (!this.behindProxy) {
                return this.parsedURL.protocol;
            }
            return (_a = this.header('x-forwarded-proto')) !== null && _a !== void 0 ? _a : this.parsedURL.protocol;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Request.prototype, "host", {
        get: function () {
            return this.parsedURL.host;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Request.prototype, "path", {
        get: function () {
            return this.parsedURL.path;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Request.prototype, "query", {
        get: function () {
            return this.parsedURL.query;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Request.prototype, "hash", {
        get: function () {
            return this.parsedURL.hash;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Request.prototype, "contentLength", {
        get: function () {
            var length = Number(this.headers['content-length']);
            return Number.isNaN(length) ? undefined : length;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Request.prototype, "contentType", {
        get: function () {
            var _a;
            return (_a = this.parsedContentType) === null || _a === void 0 ? void 0 : _a.type;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Request.prototype, "characterSet", {
        get: function () {
            var _a;
            return (_a = this.parsedContentType) === null || _a === void 0 ? void 0 : _a.characterSet;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Request.prototype, "ip", {
        get: function () {
            var _a, _b, _c, _d;
            if (!this.behindProxy) {
                return this._ip;
            }
            var header = this.header('x-forwarded-for');
            return (_d = (_c = (_b = (_a = header === null || header === void 0 ? void 0 : header.match(/^(.+?),/)) === null || _a === void 0 ? void 0 : _a[1]) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : header === null || header === void 0 ? void 0 : header.trim()) !== null && _d !== void 0 ? _d : this._ip;
        },
        enumerable: false,
        configurable: true
    });
    return Request;
}());
exports.Request = Request;
function createRequestListener(_a) {
    var _this = this;
    var secretKey = _a.secretKey, _b = _a.behindProxy, behindProxy = _b === void 0 ? false : _b, requestHandler = _a.requestHandler, responseHandler = _a.responseHandler, errorHandler = _a.errorHandler;
    return function (req, res) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var cookies, request, result, response, _a, _b, _c, _d, _e, _f, key, _g, value, options, _h, _j, _k, key, value;
        var e_2, _l, e_3, _m;
        var _this = this;
        var _o, _p, _q, _r, _s;
        return tslib_1.__generator(this, function (_t) {
            switch (_t.label) {
                case 0:
                    cookies = cookies_1.default(req, res, { keys: [secretKey] });
                    request = new Request({
                        getCookie: function (key) { return cookies.get(key, { signed: true }); },
                        behindProxy: behindProxy,
                        headers: req.headers,
                        ip: (_o = req.connection.remoteAddress) !== null && _o !== void 0 ? _o : req.socket.remoteAddress,
                        method: (_q = (_p = req.method) === null || _p === void 0 ? void 0 : _p.toUpperCase()) !== null && _q !== void 0 ? _q : 'GET',
                        url: (_r = req.url) !== null && _r !== void 0 ? _r : '/'
                    });
                    return [4 /*yield*/, fallible_1.asyncFallible(function (propagate) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var _a, state, cleanup, _b, response, _c;
                            return tslib_1.__generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        _b = propagate;
                                        return [4 /*yield*/, requestHandler(request)];
                                    case 1:
                                        _a = _b.apply(void 0, [_d.sent()]), state = _a.state, cleanup = _a.cleanup;
                                        _c = propagate;
                                        return [4 /*yield*/, responseHandler(state)];
                                    case 2:
                                        response = _c.apply(void 0, [_d.sent()]);
                                        return [4 /*yield*/, (cleanup === null || cleanup === void 0 ? void 0 : cleanup(response, state))];
                                    case 3:
                                        _d.sent();
                                        return [2 /*return*/, fallible_1.ok(response)];
                                }
                            });
                        }); })];
                case 1:
                    result = _t.sent();
                    if (!result.ok) return [3 /*break*/, 2];
                    _a = result.value;
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, errorHandler(result.value)];
                case 3:
                    _a = _t.sent();
                    _t.label = 4;
                case 4:
                    response = _a;
                    res.statusCode = (_s = response.status) !== null && _s !== void 0 ? _s : (result.ok ? 200 : 500);
                    if (response.cookies !== undefined) {
                        try {
                            for (_b = tslib_1.__values(Object.entries(response.cookies)), _c = _b.next(); !_c.done; _c = _b.next()) {
                                _d = _c.value;
                                _e = _d, _f = tslib_1.__read(_e, 2), key = _f[0], _g = _f[1], value = _g.value, options = tslib_1.__rest(_g, ["value"]);
                                cookies.set(key, value, options);
                            }
                        }
                        catch (e_2_1) { e_2 = { error: e_2_1 }; }
                        finally {
                            try {
                                if (_c && !_c.done && (_l = _b.return)) _l.call(_b);
                            }
                            finally { if (e_2) throw e_2.error; }
                        }
                    }
                    if (response.headers !== undefined) {
                        try {
                            for (_h = tslib_1.__values(Object.entries(response.headers)), _j = _h.next(); !_j.done; _j = _h.next()) {
                                _k = tslib_1.__read(_j.value, 2), key = _k[0], value = _k[1];
                                res.setHeader(key, value);
                            }
                        }
                        catch (e_3_1) { e_3 = { error: e_3_1 }; }
                        finally {
                            try {
                                if (_j && !_j.done && (_m = _h.return)) _m.call(_h);
                            }
                            finally { if (e_3) throw e_3.error; }
                        }
                    }
                    if (typeof response.body === 'string') {
                        if (!res.hasHeader('Content-Type')) {
                            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                        }
                        if (!res.hasHeader('Content-Length')) {
                            res.setHeader('Content-Length', Buffer.byteLength(response.body));
                        }
                        res.end(response.body);
                    }
                    else if (response.body instanceof Buffer) {
                        if (!res.hasHeader('Content-Type')) {
                            res.setHeader('Content-Type', 'application/octet-stream');
                        }
                        if (!res.hasHeader('Content-Length')) {
                            res.setHeader('Content-Length', response.body.length);
                        }
                        res.end(response.body);
                    }
                    else if (response.body !== undefined) {
                        if (!res.hasHeader('Content-Type')) {
                            res.setHeader('Content-Type', 'application/octet-stream');
                        }
                        response.body.pipe(res);
                    }
                    else {
                        res.end();
                    }
                    return [2 /*return*/];
            }
        });
    }); };
}
exports.createRequestListener = createRequestListener;
//# sourceMappingURL=index.js.map