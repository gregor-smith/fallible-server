"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.composeMessageHandlers = exports.createRequestListener = exports.defaultErrorHandler = void 0;
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
    var messageHandler = _a.messageHandler, _b = _a.errorHandler, errorHandler = _b === void 0 ? defaultErrorHandler : _b;
    return function (req, res) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var response, result, _a, wss_1, socket_1, _b, onOpen, onClose, onError, onMessage_1, onSendError_1, sendMessages_1, generator;
        var _this = this;
        var _c;
        return tslib_1.__generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 7, , 8]);
                    return [4 /*yield*/, messageHandler(req)];
                case 1:
                    result = _d.sent();
                    if (!result.ok) return [3 /*break*/, 4];
                    response = result.value.state;
                    if (!(result.value.cleanup !== undefined)) return [3 /*break*/, 3];
                    return [4 /*yield*/, result.value.cleanup(response)];
                case 2:
                    _d.sent();
                    _d.label = 3;
                case 3: return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, errorHandler(result.value)];
                case 5:
                    response = _d.sent();
                    _d.label = 6;
                case 6: return [3 /*break*/, 8];
                case 7:
                    _a = _d.sent();
                    response = defaultErrorHandler();
                    return [3 /*break*/, 8];
                case 8:
                    res.statusCode = (_c = response.status) !== null && _c !== void 0 ? _c : 200;
                    if (!(typeof response.body === 'string')) return [3 /*break*/, 9];
                    setHeaders(res, response);
                    if (!res.hasHeader('Content-Type')) {
                        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    }
                    if (!res.hasHeader('Content-Length')) {
                        res.setHeader('Content-Length', Buffer.byteLength(response.body));
                    }
                    res.end(response.body);
                    return [3 /*break*/, 16];
                case 9:
                    if (!(response.body instanceof Buffer)) return [3 /*break*/, 10];
                    setHeaders(res, response);
                    if (!res.hasHeader('Content-Type')) {
                        res.setHeader('Content-Type', 'application/octet-stream');
                    }
                    if (!res.hasHeader('Content-Length')) {
                        res.setHeader('Content-Length', response.body.length);
                    }
                    res.end(response.body);
                    return [3 /*break*/, 16];
                case 10:
                    if (!(response.body !== undefined)) return [3 /*break*/, 15];
                    if (!('pipe' in response.body)) return [3 /*break*/, 11];
                    setHeaders(res, response);
                    if (!res.hasHeader('Content-Type')) {
                        res.setHeader('Content-Type', 'application/octet-stream');
                    }
                    response.body.pipe(res);
                    return [3 /*break*/, 14];
                case 11:
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
                case 12:
                    socket_1 = _d.sent();
                    _b = response.body, onOpen = _b.onOpen, onClose = _b.onClose, onError = _b.onError, onMessage_1 = _b.onMessage, onSendError_1 = _b.onSendError;
                    sendMessages_1 = function (generator) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                        var _loop_1, state_1;
                        return tslib_1.__generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _loop_1 = function () {
                                        var result, error;
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
                                                    error = _a.sent();
                                                    if (!(error !== undefined && onSendError_1 !== undefined)) return [3 /*break*/, 4];
                                                    return [4 /*yield*/, onSendError_1(result.value, error)];
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
                        socket_1.on('close', onClose);
                    }
                    if (onError !== undefined) {
                        socket_1.on('error', onError);
                    }
                    socket_1.on('message', function (data) {
                        var generator = onMessage_1(data);
                        return sendMessages_1(generator);
                    });
                    if (!(onOpen !== undefined)) return [3 /*break*/, 14];
                    generator = onOpen();
                    return [4 /*yield*/, sendMessages_1(generator)];
                case 13:
                    _d.sent();
                    _d.label = 14;
                case 14: return [3 /*break*/, 16];
                case 15:
                    setHeaders(res, response);
                    res.end();
                    _d.label = 16;
                case 16: return [2 /*return*/];
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
//# sourceMappingURL=server.js.map