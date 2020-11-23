"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.composeMessageHandlers = exports.createRequestListener = exports.defaultResponseHandler = exports.defaultErrorHandler = void 0;
var tslib_1 = require("tslib");
var fallible_1 = require("fallible");
var utils_1 = require("./utils");
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
    var keys = _a.keys, messageHandler = _a.messageHandler, _b = _a.responseHandler, responseHandler = _b === void 0 ? defaultResponseHandler : _b, _c = _a.errorHandler, errorHandler = _c === void 0 ? defaultErrorHandler : _c;
    return function (req, res) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var response, result, _a, _b, _c, _d, _e, name, cookie, _f, _g, header, _h, _j, _k, key, value;
        var e_1, _l, e_2, _m, e_3, _o;
        var _this = this;
        var _p;
        return tslib_1.__generator(this, function (_q) {
            switch (_q.label) {
                case 0:
                    _q.trys.push([0, 5, , 6]);
                    return [4 /*yield*/, fallible_1.asyncFallible(function (propagate) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var _a, state, cleanup, _b, response, _c, _d;
                            return tslib_1.__generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0:
                                        _b = propagate;
                                        return [4 /*yield*/, messageHandler(req, {})];
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
                case 1:
                    result = _q.sent();
                    if (!result.ok) return [3 /*break*/, 2];
                    _a = result.value;
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, errorHandler(result.value)];
                case 3:
                    _a = _q.sent();
                    _q.label = 4;
                case 4:
                    response = _a;
                    return [3 /*break*/, 6];
                case 5:
                    _b = _q.sent();
                    response = defaultErrorHandler();
                    return [3 /*break*/, 6];
                case 6:
                    res.statusCode = (_p = response.status) !== null && _p !== void 0 ? _p : 200;
                    if (response.cookies !== undefined) {
                        try {
                            for (_c = tslib_1.__values(Object.entries(response.cookies)), _d = _c.next(); !_d.done; _d = _c.next()) {
                                _e = tslib_1.__read(_d.value, 2), name = _e[0], cookie = _e[1];
                                try {
                                    for (_f = (e_2 = void 0, tslib_1.__values(utils_1.cookieToSignedHeaders(name, cookie, keys))), _g = _f.next(); !_g.done; _g = _f.next()) {
                                        header = _g.value;
                                        res.setHeader('Set-Cookie', header);
                                    }
                                }
                                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                                finally {
                                    try {
                                        if (_g && !_g.done && (_m = _f.return)) _m.call(_f);
                                    }
                                    finally { if (e_2) throw e_2.error; }
                                }
                            }
                        }
                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                        finally {
                            try {
                                if (_d && !_d.done && (_l = _c.return)) _l.call(_c);
                            }
                            finally { if (e_1) throw e_1.error; }
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
                                if (_j && !_j.done && (_o = _h.return)) _o.call(_h);
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
                case 6: return [2 /*return*/, fallible_1.ok()];
            }
        });
    });
}
function composeMessageHandlers(handlers, composeCleanupErrors) {
    var _this = this;
    return function (message, state) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
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
                                case 0: return [4 /*yield*/, handler(message, state)];
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
exports.composeMessageHandlers = composeMessageHandlers;
//# sourceMappingURL=index.js.map