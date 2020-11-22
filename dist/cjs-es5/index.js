"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.composeRequestHandlers = exports.createRequestListener = exports.defaultResponseHandler = exports.defaultErrorHandler = exports.Request = void 0;
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
function defaultErrorHandler() {
    return {
        status: 500,
        body: 'Internal server error'
    };
}
exports.defaultErrorHandler = defaultErrorHandler;
function defaultResponseHandler() {
    return fallible_1.ok({
        status: 200,
        body: ''
    });
}
exports.defaultResponseHandler = defaultResponseHandler;
function createRequestListener(_a) {
    var _this = this;
    var secretKey = _a.secretKey, _b = _a.behindProxy, behindProxy = _b === void 0 ? false : _b, requestHandler = _a.requestHandler, _c = _a.responseHandler, responseHandler = _c === void 0 ? defaultResponseHandler : _c, _d = _a.errorHandler, errorHandler = _d === void 0 ? defaultErrorHandler : _d;
    return function (req, res) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var cookies, request, response, result, _a, _b, _c, _d, _e, _f, _g, key, _h, value, options, _j, _k, _l, key, value;
        var e_2, _m, e_3, _o;
        var _this = this;
        var _p, _q, _r, _s, _t;
        return tslib_1.__generator(this, function (_u) {
            switch (_u.label) {
                case 0:
                    cookies = cookies_1.default(req, res, { keys: [secretKey] });
                    request = new Request({
                        getCookie: function (key) { return cookies.get(key, { signed: true }); },
                        behindProxy: behindProxy,
                        headers: req.headers,
                        ip: (_p = req.connection.remoteAddress) !== null && _p !== void 0 ? _p : req.socket.remoteAddress,
                        method: (_r = (_q = req.method) === null || _q === void 0 ? void 0 : _q.toUpperCase()) !== null && _r !== void 0 ? _r : 'GET',
                        url: (_s = req.url) !== null && _s !== void 0 ? _s : '/'
                    });
                    _u.label = 1;
                case 1:
                    _u.trys.push([1, 6, , 7]);
                    return [4 /*yield*/, fallible_1.asyncFallible(function (propagate) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var _a, state, cleanup, _b, response, _c, _d;
                            return tslib_1.__generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0:
                                        _b = propagate;
                                        return [4 /*yield*/, requestHandler(request, {})];
                                    case 1:
                                        _a = _b.apply(void 0, [_e.sent()]), state = _a.state, cleanup = _a.cleanup;
                                        _c = propagate;
                                        return [4 /*yield*/, responseHandler(state)];
                                    case 2:
                                        response = _c.apply(void 0, [_e.sent()]);
                                        if (!(cleanup !== undefined)) return [3 /*break*/, 4];
                                        _d = propagate;
                                        return [4 /*yield*/, cleanup(response)];
                                    case 3:
                                        _d.apply(void 0, [_e.sent()]);
                                        _e.label = 4;
                                    case 4: return [2 /*return*/, fallible_1.ok(response)];
                                }
                            });
                        }); })];
                case 2:
                    result = _u.sent();
                    if (!result.ok) return [3 /*break*/, 3];
                    _a = result.value;
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, errorHandler(result.value)];
                case 4:
                    _a = _u.sent();
                    _u.label = 5;
                case 5:
                    response = _a;
                    return [3 /*break*/, 7];
                case 6:
                    _b = _u.sent();
                    response = defaultErrorHandler();
                    return [3 /*break*/, 7];
                case 7:
                    res.statusCode = (_t = response.status) !== null && _t !== void 0 ? _t : 200;
                    if (response.cookies !== undefined) {
                        try {
                            for (_c = tslib_1.__values(Object.entries(response.cookies)), _d = _c.next(); !_d.done; _d = _c.next()) {
                                _e = _d.value;
                                _f = _e, _g = tslib_1.__read(_f, 2), key = _g[0], _h = _g[1], value = _h.value, options = tslib_1.__rest(_h, ["value"]);
                                cookies.set(key, value, options);
                            }
                        }
                        catch (e_2_1) { e_2 = { error: e_2_1 }; }
                        finally {
                            try {
                                if (_d && !_d.done && (_m = _c.return)) _m.call(_c);
                            }
                            finally { if (e_2) throw e_2.error; }
                        }
                    }
                    if (response.headers !== undefined) {
                        try {
                            for (_j = tslib_1.__values(Object.entries(response.headers)), _k = _j.next(); !_k.done; _k = _j.next()) {
                                _l = tslib_1.__read(_k.value, 2), key = _l[0], value = _l[1];
                                res.setHeader(key, value);
                            }
                        }
                        catch (e_3_1) { e_3 = { error: e_3_1 }; }
                        finally {
                            try {
                                if (_k && !_k.done && (_o = _j.return)) _o.call(_j);
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
function composeCleanups(cleanups, response, composeErrors) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var errors, index, result, composed;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    errors = [];
                    index = cleanups.length;
                    _a.label = 1;
                case 1:
                    if (!(index >= 0)) return [3 /*break*/, 4];
                    return [4 /*yield*/, cleanups[index](response)];
                case 2:
                    result = _a.sent();
                    if (!result.ok) {
                        errors.push(result.value);
                    }
                    _a.label = 3;
                case 3:
                    index--;
                    return [3 /*break*/, 1];
                case 4:
                    if (!(errors.length !== 0)) return [3 /*break*/, 6];
                    return [4 /*yield*/, composeErrors(errors)];
                case 5:
                    composed = _a.sent();
                    return [2 /*return*/, fallible_1.error(composed)];
                case 6: return [2 /*return*/, fallible_1.ok(undefined)];
            }
        });
    });
}
function composeRequestHandlers(handlers, composeCleanupErrors) {
    var _this = this;
    return function (request, state) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var cleanups, _loop_1, handlers_1, handlers_1_1, handler, state_1, e_4_1;
        var e_4, _a;
        var _this = this;
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    cleanups = [];
                    _loop_1 = function (handler) {
                        var result;
                        return tslib_1.__generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, handler(request, state)];
                                case 1:
                                    result = _a.sent();
                                    if (!result.ok) {
                                        return [2 /*return*/, { value: fallible_1.asyncFallible(function (propagate) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                                    var _a;
                                                    return tslib_1.__generator(this, function (_b) {
                                                        switch (_b.label) {
                                                            case 0:
                                                                _a = propagate;
                                                                return [4 /*yield*/, composeCleanups(cleanups, undefined, composeCleanupErrors)];
                                                            case 1:
                                                                _a.apply(void 0, [_b.sent()]);
                                                                return [2 /*return*/, result];
                                                        }
                                                    });
                                                }); }) }];
                                    }
                                    state = result.value.state;
                                    if (result.value.cleanup !== undefined) {
                                        cleanups.push(result.value.cleanup);
                                    }
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 6, 7, 8]);
                    handlers_1 = tslib_1.__values(handlers), handlers_1_1 = handlers_1.next();
                    _b.label = 2;
                case 2:
                    if (!!handlers_1_1.done) return [3 /*break*/, 5];
                    handler = handlers_1_1.value;
                    return [5 /*yield**/, _loop_1(handler)];
                case 3:
                    state_1 = _b.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _b.label = 4;
                case 4:
                    handlers_1_1 = handlers_1.next();
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 8];
                case 6:
                    e_4_1 = _b.sent();
                    e_4 = { error: e_4_1 };
                    return [3 /*break*/, 8];
                case 7:
                    try {
                        if (handlers_1_1 && !handlers_1_1.done && (_a = handlers_1.return)) _a.call(handlers_1);
                    }
                    finally { if (e_4) throw e_4.error; }
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/, fallible_1.ok({
                        state: state,
                        cleanup: function (response) {
                            return composeCleanups(cleanups, response, composeCleanupErrors);
                        }
                    })];
            }
        });
    }); };
}
exports.composeRequestHandlers = composeRequestHandlers;
//# sourceMappingURL=index.js.map