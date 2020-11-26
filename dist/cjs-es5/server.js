"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.composeMessageHandlers = exports.createRequestListener = exports.defaultResponseHandler = exports.defaultErrorHandler = void 0;
var tslib_1 = require("tslib");
var ws_1 = require("ws");
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
    var messageHandler = _a.messageHandler, _b = _a.responseHandler, responseHandler = _b === void 0 ? defaultResponseHandler : _b, _c = _a.errorHandler, errorHandler = _c === void 0 ? defaultErrorHandler : _c;
    return function (req, res) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var response, result, _a, exception_1, _b, _c, _d, name, cookie, header, _e, _f, _g, key, value, wss_1, _h, onOpen_1, onMessage_1, onError_1, onClose_1;
        var e_1, _j, e_2, _k;
        var _this = this;
        var _l;
        return tslib_1.__generator(this, function (_m) {
            switch (_m.label) {
                case 0:
                    _m.trys.push([0, 5, , 6]);
                    return [4 /*yield*/, fallible_1.asyncFallible(function (propagate) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var _a, state, cleanup, _b, response, _c;
                            return tslib_1.__generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        _b = propagate;
                                        return [4 /*yield*/, messageHandler(req, {})];
                                    case 1:
                                        _a = _b.apply(void 0, [_d.sent()]), state = _a.state, cleanup = _a.cleanup;
                                        return [4 /*yield*/, responseHandler(state)];
                                    case 2:
                                        response = _d.sent();
                                        if (!(cleanup !== undefined)) return [3 /*break*/, 4];
                                        _c = propagate;
                                        return [4 /*yield*/, cleanup()];
                                    case 3:
                                        _c.apply(void 0, [_d.sent()]);
                                        _d.label = 4;
                                    case 4: return [2 /*return*/, response];
                                }
                            });
                        }); })];
                case 1:
                    result = _m.sent();
                    if (!result.ok) return [3 /*break*/, 2];
                    _a = result.value;
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, errorHandler(result.value)];
                case 3:
                    _a = _m.sent();
                    _m.label = 4;
                case 4:
                    response = _a;
                    return [3 /*break*/, 6];
                case 5:
                    exception_1 = _m.sent();
                    response = defaultErrorHandler();
                    return [3 /*break*/, 6];
                case 6:
                    res.statusCode = (_l = response.status) !== null && _l !== void 0 ? _l : 200;
                    if (response.cookies !== undefined) {
                        try {
                            for (_b = tslib_1.__values(Object.entries(response.cookies)), _c = _b.next(); !_c.done; _c = _b.next()) {
                                _d = tslib_1.__read(_c.value, 2), name = _d[0], cookie = _d[1];
                                header = utils_1.cookieHeader(name, cookie);
                                res.setHeader('Set-Cookie', header);
                            }
                        }
                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                        finally {
                            try {
                                if (_c && !_c.done && (_j = _b.return)) _j.call(_b);
                            }
                            finally { if (e_1) throw e_1.error; }
                        }
                    }
                    if (response.headers !== undefined) {
                        try {
                            for (_e = tslib_1.__values(Object.entries(response.headers)), _f = _e.next(); !_f.done; _f = _e.next()) {
                                _g = tslib_1.__read(_f.value, 2), key = _g[0], value = _g[1];
                                res.setHeader(key, value);
                            }
                        }
                        catch (e_2_1) { e_2 = { error: e_2_1 }; }
                        finally {
                            try {
                                if (_f && !_f.done && (_k = _e.return)) _k.call(_e);
                            }
                            finally { if (e_2) throw e_2.error; }
                        }
                    }
                    if (!(typeof response.body === 'string')) return [3 /*break*/, 7];
                    if (!res.hasHeader('Content-Type')) {
                        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    }
                    if (!res.hasHeader('Content-Length')) {
                        res.setHeader('Content-Length', Buffer.byteLength(response.body));
                    }
                    res.end(response.body);
                    return [3 /*break*/, 13];
                case 7:
                    if (!(response.body instanceof Buffer)) return [3 /*break*/, 8];
                    if (!res.hasHeader('Content-Type')) {
                        res.setHeader('Content-Type', 'application/octet-stream');
                    }
                    if (!res.hasHeader('Content-Length')) {
                        res.setHeader('Content-Length', response.body.length);
                    }
                    res.end(response.body);
                    return [3 /*break*/, 13];
                case 8:
                    if (!(response.body !== undefined)) return [3 /*break*/, 12];
                    if (!('pipe' in response.body)) return [3 /*break*/, 9];
                    if (!res.hasHeader('Content-Type')) {
                        res.setHeader('Content-Type', 'application/octet-stream');
                    }
                    response.body.pipe(res);
                    return [3 /*break*/, 11];
                case 9:
                    wss_1 = new ws_1.Server({ noServer: true });
                    return [4 /*yield*/, new Promise(function (resolve) {
                            return wss_1.handleUpgrade(req, req.socket, Buffer.alloc(0), resolve);
                        })];
                case 10:
                    _m.sent();
                    _h = response.body, onOpen_1 = _h.onOpen, onMessage_1 = _h.onMessage, onError_1 = _h.onError, onClose_1 = _h.onClose;
                    wss_1.on('connection', function (socket) {
                        if (onOpen_1 !== undefined) {
                            socket.on('open', onOpen_1);
                        }
                        if (onClose_1 !== undefined) {
                            socket.on('close', onClose_1);
                        }
                        if (onError_1 !== undefined) {
                            socket.on('error', onError_1);
                        }
                        socket.on('message', function (data) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var _a, _b, response_1, e_3_1;
                            var e_3, _c;
                            return tslib_1.__generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        _d.trys.push([0, 6, 7, 12]);
                                        _a = tslib_1.__asyncValues(onMessage_1(data));
                                        _d.label = 1;
                                    case 1: return [4 /*yield*/, _a.next()];
                                    case 2:
                                        if (!(_b = _d.sent(), !_b.done)) return [3 /*break*/, 5];
                                        response_1 = _b.value;
                                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                                return socket.send(response_1, function (error) {
                                                    return error === undefined
                                                        ? resolve()
                                                        : reject(error);
                                                });
                                            })];
                                    case 3:
                                        _d.sent();
                                        _d.label = 4;
                                    case 4: return [3 /*break*/, 1];
                                    case 5: return [3 /*break*/, 12];
                                    case 6:
                                        e_3_1 = _d.sent();
                                        e_3 = { error: e_3_1 };
                                        return [3 /*break*/, 12];
                                    case 7:
                                        _d.trys.push([7, , 10, 11]);
                                        if (!(_b && !_b.done && (_c = _a.return))) return [3 /*break*/, 9];
                                        return [4 /*yield*/, _c.call(_a)];
                                    case 8:
                                        _d.sent();
                                        _d.label = 9;
                                    case 9: return [3 /*break*/, 11];
                                    case 10:
                                        if (e_3) throw e_3.error;
                                        return [7 /*endfinally*/];
                                    case 11: return [7 /*endfinally*/];
                                    case 12: return [2 /*return*/];
                                }
                            });
                        }); });
                    });
                    _m.label = 11;
                case 11: return [3 /*break*/, 13];
                case 12:
                    res.end();
                    _m.label = 13;
                case 13: return [2 /*return*/];
            }
        });
    }); };
}
exports.createRequestListener = createRequestListener;
function composeCleanups(cleanups, composeErrors) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var errors, index, result, composed;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    errors = [];
                    index = cleanups.length - 1;
                    _a.label = 1;
                case 1:
                    if (!(index >= 0)) return [3 /*break*/, 4];
                    return [4 /*yield*/, cleanups[index]()];
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
                                                                return [4 /*yield*/, composeCleanups(cleanups, composeCleanupErrors)];
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
                        cleanup: cleanups.length === 0
                            ? undefined
                            : function () { return composeCleanups(cleanups, composeCleanupErrors); }
                    })];
            }
        });
    }); };
}
exports.composeMessageHandlers = composeMessageHandlers;
//# sourceMappingURL=server.js.map