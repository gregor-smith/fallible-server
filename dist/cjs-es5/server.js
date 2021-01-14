"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fallthroughMessageHandler = exports.composeMessageHandlers = exports.createRequestListener = exports.defaultErrorHandler = void 0;
var tslib_1 = require("tslib");
var ws_1 = require("ws");
var fallible_1 = require("fallible");
var general_utils_1 = require("./general-utils");
function defaultErrorHandler() {
    return {
        status: 500,
        body: 'Internal server error'
    };
}
exports.defaultErrorHandler = defaultErrorHandler;
function setHeaders(response, _a) {
    var e_1, _b, e_2, _c;
    var cookies = _a.cookies, headers = _a.headers;
    if (cookies !== undefined) {
        try {
            for (var _d = tslib_1.__values(Object.entries(cookies)), _e = _d.next(); !_e.done; _e = _d.next()) {
                var _f = tslib_1.__read(_e.value, 2), name = _f[0], cookie = _f[1];
                var header = general_utils_1.cookieHeader(name, cookie);
                response.setHeader('Set-Cookie', header);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    if (headers !== undefined) {
        try {
            for (var _g = tslib_1.__values(Object.entries(headers)), _h = _g.next(); !_h.done; _h = _g.next()) {
                var _j = tslib_1.__read(_h.value, 2), key = _j[0], value = _j[1];
                response.setHeader(key, String(value));
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_h && !_h.done && (_c = _g.return)) _c.call(_g);
            }
            finally { if (e_2) throw e_2.error; }
        }
    }
}
function createRequestListener(_a) {
    var _this = this;
    var messageHandler = _a.messageHandler, _b = _a.errorHandler, errorHandler = _b === void 0 ? defaultErrorHandler : _b, _c = _a.exceptionHandler, exceptionHandler = _c === void 0 ? defaultErrorHandler : _c;
    return function (req, res) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var response, cleanup, result, exception_1, wss_1, socket_1, _a, onOpen, onClose, onError, onMessage_1, onSendError_1, sendMessages_1, generator;
        var _this = this;
        var _b;
        return tslib_1.__generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 5, , 7]);
                    return [4 /*yield*/, messageHandler(req)];
                case 1:
                    result = _c.sent();
                    if (!result.ok) return [3 /*break*/, 2];
                    response = result.value.state;
                    cleanup = result.value.cleanup;
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, errorHandler(result.value)];
                case 3:
                    response = _c.sent();
                    _c.label = 4;
                case 4: return [3 /*break*/, 7];
                case 5:
                    exception_1 = _c.sent();
                    return [4 /*yield*/, exceptionHandler(exception_1)];
                case 6:
                    response = _c.sent();
                    return [3 /*break*/, 7];
                case 7:
                    res.statusCode = (_b = response.status) !== null && _b !== void 0 ? _b : 200;
                    if (!(typeof response.body === 'string')) return [3 /*break*/, 9];
                    setHeaders(res, response);
                    if (!res.hasHeader('Content-Type')) {
                        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    }
                    if (!res.hasHeader('Content-Length')) {
                        res.setHeader('Content-Length', Buffer.byteLength(response.body));
                    }
                    return [4 /*yield*/, new Promise(function (resolve) {
                            return res.end(response.body, resolve);
                        })];
                case 8:
                    _c.sent();
                    return [3 /*break*/, 21];
                case 9:
                    if (!(response.body instanceof Buffer)) return [3 /*break*/, 11];
                    setHeaders(res, response);
                    if (!res.hasHeader('Content-Type')) {
                        res.setHeader('Content-Type', 'application/octet-stream');
                    }
                    if (!res.hasHeader('Content-Length')) {
                        res.setHeader('Content-Length', response.body.length);
                    }
                    return [4 /*yield*/, new Promise(function (resolve) {
                            return res.end(response.body, resolve);
                        })];
                case 10:
                    _c.sent();
                    return [3 /*break*/, 21];
                case 11:
                    if (!(response.body !== undefined)) return [3 /*break*/, 19];
                    if (!('pipe' in response.body)) return [3 /*break*/, 13];
                    setHeaders(res, response);
                    if (!res.hasHeader('Content-Type')) {
                        res.setHeader('Content-Type', 'application/octet-stream');
                    }
                    return [4 /*yield*/, new Promise(function (resolve) {
                            response.body.on('end', resolve);
                            response.body.pipe(res);
                        })];
                case 12:
                    _c.sent();
                    return [3 /*break*/, 18];
                case 13:
                    wss_1 = new ws_1.Server({ noServer: true });
                    wss_1.on('headers', function (headers) {
                        var e_3, _a, e_4, _b;
                        if (response.cookies !== undefined) {
                            try {
                                for (var _c = tslib_1.__values(Object.entries(response.cookies)), _d = _c.next(); !_d.done; _d = _c.next()) {
                                    var _e = tslib_1.__read(_d.value, 2), name = _e[0], cookie = _e[1];
                                    var header = general_utils_1.cookieHeader(name, cookie);
                                    headers.push("Set-Cookie: " + header);
                                }
                            }
                            catch (e_3_1) { e_3 = { error: e_3_1 }; }
                            finally {
                                try {
                                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                                }
                                finally { if (e_3) throw e_3.error; }
                            }
                        }
                        if (response.headers !== undefined) {
                            try {
                                for (var _f = tslib_1.__values(Object.entries(response.headers)), _g = _f.next(); !_g.done; _g = _f.next()) {
                                    var _h = tslib_1.__read(_g.value, 2), key = _h[0], value = _h[1];
                                    headers.push(key + ": " + value);
                                }
                            }
                            catch (e_4_1) { e_4 = { error: e_4_1 }; }
                            finally {
                                try {
                                    if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
                                }
                                finally { if (e_4) throw e_4.error; }
                            }
                        }
                    });
                    return [4 /*yield*/, new Promise(function (resolve) {
                            return wss_1.handleUpgrade(req, req.socket, Buffer.alloc(0), resolve);
                        })];
                case 14:
                    socket_1 = _c.sent();
                    _a = response.body, onOpen = _a.onOpen, onClose = _a.onClose, onError = _a.onError, onMessage_1 = _a.onMessage, onSendError_1 = _a.onSendError;
                    sendMessages_1 = function (generator) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                        var _loop_1, state_1;
                        return tslib_1.__generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _loop_1 = function () {
                                        var result, error_1;
                                        return tslib_1.__generator(this, function (_a) {
                                            switch (_a.label) {
                                                case 0: return [4 /*yield*/, generator.next()];
                                                case 1:
                                                    result = _a.sent();
                                                    if (result.done) {
                                                        if (result.value === general_utils_1.CloseWebSocket) {
                                                            socket_1.close(1000);
                                                        }
                                                        return [2 /*return*/, { value: void 0 }];
                                                    }
                                                    return [4 /*yield*/, new Promise(function (resolve) {
                                                            return socket_1.send(result.value, resolve);
                                                        })];
                                                case 2:
                                                    error_1 = _a.sent();
                                                    if (!(error_1 !== undefined && onSendError_1 !== undefined)) return [3 /*break*/, 4];
                                                    return [4 /*yield*/, onSendError_1(result.value, error_1)];
                                                case 3:
                                                    _a.sent();
                                                    _a.label = 4;
                                                case 4: return [2 /*return*/];
                                            }
                                        });
                                    };
                                    _a.label = 1;
                                case 1:
                                    if (!true) return [3 /*break*/, 3];
                                    return [5 /*yield**/, _loop_1()];
                                case 2:
                                    state_1 = _a.sent();
                                    if (typeof state_1 === "object")
                                        return [2 /*return*/, state_1.value];
                                    return [3 /*break*/, 1];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); };
                    if (onClose !== undefined) {
                        socket_1.addListener('close', onClose);
                    }
                    if (onError !== undefined) {
                        socket_1.on('error', onError);
                    }
                    socket_1.on('message', function (data) {
                        var generator = onMessage_1(data);
                        return sendMessages_1(generator);
                    });
                    if (!(onOpen === undefined)) return [3 /*break*/, 16];
                    return [4 /*yield*/, new Promise(function (resolve) {
                            return socket_1.addListener('close', resolve);
                        })];
                case 15:
                    _c.sent();
                    return [3 /*break*/, 18];
                case 16:
                    generator = onOpen();
                    return [4 /*yield*/, Promise.all([
                            new Promise(function (resolve) {
                                return socket_1.addListener('close', resolve);
                            }),
                            sendMessages_1(generator)
                        ])];
                case 17:
                    _c.sent();
                    _c.label = 18;
                case 18: return [3 /*break*/, 21];
                case 19:
                    setHeaders(res, response);
                    return [4 /*yield*/, new Promise(function (resolve) { return res.end(resolve); })];
                case 20:
                    _c.sent();
                    _c.label = 21;
                case 21:
                    if (!(cleanup !== undefined)) return [3 /*break*/, 23];
                    return [4 /*yield*/, cleanup(response)];
                case 22:
                    _c.sent();
                    _c.label = 23;
                case 23: return [2 /*return*/];
            }
        });
    }); };
}
exports.createRequestListener = createRequestListener;
function composedCleanups(cleanups) {
    var _this = this;
    return function (response) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var index;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    index = cleanups.length - 1;
                    _a.label = 1;
                case 1:
                    if (!(index >= 0)) return [3 /*break*/, 4];
                    return [4 /*yield*/, cleanups[index](response)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    index--;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    }); };
}
function composeMessageHandlers(handlers) {
    var _this = this;
    return function (message, state) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var cleanups, handlers_1, handlers_1_1, handler, result, e_5_1;
        var e_5, _a;
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    cleanups = [];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 8, 9, 10]);
                    handlers_1 = tslib_1.__values(handlers), handlers_1_1 = handlers_1.next();
                    _b.label = 2;
                case 2:
                    if (!!handlers_1_1.done) return [3 /*break*/, 7];
                    handler = handlers_1_1.value;
                    return [4 /*yield*/, handler(message, state)];
                case 3:
                    result = _b.sent();
                    if (!!result.ok) return [3 /*break*/, 5];
                    return [4 /*yield*/, composedCleanups(cleanups)()];
                case 4:
                    _b.sent();
                    return [2 /*return*/, result];
                case 5:
                    state = result.value.state;
                    if (result.value.cleanup !== undefined) {
                        cleanups.push(result.value.cleanup);
                    }
                    _b.label = 6;
                case 6:
                    handlers_1_1 = handlers_1.next();
                    return [3 /*break*/, 2];
                case 7: return [3 /*break*/, 10];
                case 8:
                    e_5_1 = _b.sent();
                    e_5 = { error: e_5_1 };
                    return [3 /*break*/, 10];
                case 9:
                    try {
                        if (handlers_1_1 && !handlers_1_1.done && (_a = handlers_1.return)) _a.call(handlers_1);
                    }
                    finally { if (e_5) throw e_5.error; }
                    return [7 /*endfinally*/];
                case 10: return [2 /*return*/, fallible_1.ok({
                        state: state,
                        cleanup: cleanups.length === 0
                            ? undefined
                            : composedCleanups(cleanups)
                    })];
            }
        });
    }); };
}
exports.composeMessageHandlers = composeMessageHandlers;
function fallthroughMessageHandler(handlers, isNext, noMatch) {
    var _this = this;
    return function (message, state) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var handlers_2, handlers_2_1, handler, result, e_6_1;
        var e_6, _a;
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 5, 6, 7]);
                    handlers_2 = tslib_1.__values(handlers), handlers_2_1 = handlers_2.next();
                    _b.label = 1;
                case 1:
                    if (!!handlers_2_1.done) return [3 /*break*/, 4];
                    handler = handlers_2_1.value;
                    return [4 /*yield*/, handler(message, state)];
                case 2:
                    result = _b.sent();
                    if (result.ok || !isNext(result.value)) {
                        return [2 /*return*/, result];
                    }
                    _b.label = 3;
                case 3:
                    handlers_2_1 = handlers_2.next();
                    return [3 /*break*/, 1];
                case 4: return [3 /*break*/, 7];
                case 5:
                    e_6_1 = _b.sent();
                    e_6 = { error: e_6_1 };
                    return [3 /*break*/, 7];
                case 6:
                    try {
                        if (handlers_2_1 && !handlers_2_1.done && (_a = handlers_2.return)) _a.call(handlers_2);
                    }
                    finally { if (e_6) throw e_6.error; }
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/, fallible_1.error(noMatch())];
            }
        });
    }); };
}
exports.fallthroughMessageHandler = fallthroughMessageHandler;
//# sourceMappingURL=server.js.map