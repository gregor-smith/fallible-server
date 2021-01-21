"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fallthroughMessageHandler = exports.composeMessageHandlers = exports.createRequestListener = exports.defaultOnWebsocketSendError = exports.defaultErrorHandler = void 0;
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
function defaultOnWebsocketSendError(_, _a) {
    var name = _a.name, message = _a.message;
    console.warn("Unknown error sending Websocket message. Consider adding an 'onSendError' callback to your response. Name: '" + name + "'. Message: '" + message + "'");
}
exports.defaultOnWebsocketSendError = defaultOnWebsocketSendError;
function iterateHeaders(_a) {
    var _b, _c, _d, name, value, e_1_1, values;
    var e_1, _e;
    var cookies = _a.cookies, headers = _a.headers;
    return tslib_1.__generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                if (!(headers !== undefined)) return [3 /*break*/, 8];
                _f.label = 1;
            case 1:
                _f.trys.push([1, 6, 7, 8]);
                _b = tslib_1.__values(Object.entries(headers)), _c = _b.next();
                _f.label = 2;
            case 2:
                if (!!_c.done) return [3 /*break*/, 5];
                _d = tslib_1.__read(_c.value, 2), name = _d[0], value = _d[1];
                return [4 /*yield*/, typeof value === 'object'
                        ? [name, value.map(String)]
                        : [name, String(value)]];
            case 3:
                _f.sent();
                _f.label = 4;
            case 4:
                _c = _b.next();
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 8];
            case 6:
                e_1_1 = _f.sent();
                e_1 = { error: e_1_1 };
                return [3 /*break*/, 8];
            case 7:
                try {
                    if (_c && !_c.done && (_e = _b.return)) _e.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
                return [7 /*endfinally*/];
            case 8:
                if (!(cookies !== undefined)) return [3 /*break*/, 10];
                values = Object.entries(cookies)
                    .map(function (_a) {
                    var _b = tslib_1.__read(_a, 2), name = _b[0], cookie = _b[1];
                    return general_utils_1.cookieHeader(name, cookie);
                });
                return [4 /*yield*/, ['Set-Cookie', values]];
            case 9:
                _f.sent();
                _f.label = 10;
            case 10: return [2 /*return*/];
        }
    });
}
function setResponseHeaders(res, response) {
    var e_2, _a;
    try {
        for (var _b = tslib_1.__values(iterateHeaders(response)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = tslib_1.__read(_c.value, 2), name = _d[0], values = _d[1];
            res.setHeader(name, values);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_2) throw e_2.error; }
    }
}
function sendWebsocketMessages(websocket, messages, onError) {
    if (onError === void 0) { onError = defaultOnWebsocketSendError; }
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var _loop_1, state_1;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _loop_1 = function () {
                        var result, error_1;
                        return tslib_1.__generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, messages.next()];
                                case 1:
                                    result = _a.sent();
                                    if (result.done) {
                                        if (result.value === general_utils_1.CloseWebSocket) {
                                            websocket.close(1000); // regular close status
                                        }
                                        return [2 /*return*/, { value: void 0 }];
                                    }
                                    return [4 /*yield*/, new Promise(function (resolve) {
                                            return websocket.send(result.value, resolve);
                                        })
                                        // the only time an error *should* occur is if the readyState changes
                                        // in between the message being fetched and it being sent, which is
                                        // definitely possible since these are both async operations.
                                        // the underlying socket should not throw or return an error from the
                                        // the send callback because the websocket listens for the socket's
                                        // error event, which when fired results in the websocket being closed.
                                        // see:
                                        // https://github.com/websockets/ws/blob/d1a8af4ddb1b24a4ee23acf66decb0ed0e0d8862/lib/websocket.js#L923
                                        // https://github.com/websockets/ws/blob/d1a8af4ddb1b24a4ee23acf66decb0ed0e0d8862/lib/websocket.js#L856
                                        // that said, javascript is javascript, so on the safe assumption that
                                        // there is some kind of unlikely albeit possible edge case, we
                                        // pass any unknown errors to onError and then close the connection.
                                    ];
                                case 2:
                                    error_1 = _a.sent();
                                    if (!(error_1 !== undefined)) return [3 /*break*/, 4];
                                    if (websocket.readyState !== websocket.OPEN) {
                                        return [2 /*return*/, { value: void 0 }];
                                    }
                                    return [4 /*yield*/, onError(result.value, error_1)];
                                case 3:
                                    _a.sent();
                                    websocket.close(1011); // server error close status
                                    _a.label = 4;
                                case 4: return [2 /*return*/];
                            }
                        });
                    };
                    _a.label = 1;
                case 1:
                    if (!(websocket.readyState === websocket.OPEN)) return [3 /*break*/, 3];
                    return [5 /*yield**/, _loop_1()];
                case 2:
                    state_1 = _a.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    return [3 /*break*/, 1];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function createRequestListener(_a) {
    var _this = this;
    var messageHandler = _a.messageHandler, _b = _a.errorHandler, errorHandler = _b === void 0 ? defaultErrorHandler : _b, _c = _a.exceptionHandler, exceptionHandler = _c === void 0 ? defaultErrorHandler : _c;
    return function (req, res) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var response, cleanup, result, exception_1, server_1, websocket_1, _a, onOpen, onClose, onMessage_1, onSendError_1, closeReason;
        var _b;
        var _c;
        return tslib_1.__generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 5, , 7]);
                    return [4 /*yield*/, messageHandler(req)];
                case 1:
                    result = _d.sent();
                    if (!result.ok) return [3 /*break*/, 2];
                    response = result.value.state;
                    cleanup = result.value.cleanup;
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, errorHandler(result.value)];
                case 3:
                    response = _d.sent();
                    _d.label = 4;
                case 4: return [3 /*break*/, 7];
                case 5:
                    exception_1 = _d.sent();
                    return [4 /*yield*/, exceptionHandler(exception_1)];
                case 6:
                    response = _d.sent();
                    return [3 /*break*/, 7];
                case 7:
                    res.statusCode = (_c = response.status) !== null && _c !== void 0 ? _c : 200;
                    if (!(typeof response.body === 'string')) return [3 /*break*/, 9];
                    setResponseHeaders(res, response);
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
                    _d.sent();
                    return [3 /*break*/, 22];
                case 9:
                    if (!(response.body instanceof Buffer)) return [3 /*break*/, 11];
                    setResponseHeaders(res, response);
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
                    _d.sent();
                    return [3 /*break*/, 22];
                case 11:
                    if (!(response.body === undefined)) return [3 /*break*/, 13];
                    setResponseHeaders(res, response);
                    if (!res.hasHeader('Content-Length')) {
                        res.setHeader('Content-Length', 0);
                    }
                    return [4 /*yield*/, new Promise(function (resolve) { return res.end(resolve); })];
                case 12:
                    _d.sent();
                    return [3 /*break*/, 22];
                case 13:
                    if (!('pipe' in response.body)) return [3 /*break*/, 15];
                    setResponseHeaders(res, response);
                    if (!res.hasHeader('Content-Type')) {
                        res.setHeader('Content-Type', 'application/octet-stream');
                    }
                    return [4 /*yield*/, new Promise(function (resolve) {
                            res.on('finish', resolve);
                            response.body.pipe(res);
                        })];
                case 14:
                    _d.sent();
                    return [3 /*break*/, 22];
                case 15:
                    server_1 = new ws_1.Server({ noServer: true });
                    server_1.on('headers', function (headers) {
                        var e_3, _a, e_4, _b;
                        try {
                            for (var _c = tslib_1.__values(iterateHeaders(response)), _d = _c.next(); !_d.done; _d = _c.next()) {
                                var _e = tslib_1.__read(_d.value, 2), name = _e[0], values = _e[1];
                                if (typeof values === 'string') {
                                    headers.push(name + ": " + values);
                                }
                                else {
                                    try {
                                        for (var values_1 = (e_4 = void 0, tslib_1.__values(values)), values_1_1 = values_1.next(); !values_1_1.done; values_1_1 = values_1.next()) {
                                            var value = values_1_1.value;
                                            headers.push(name + ": " + value);
                                        }
                                    }
                                    catch (e_4_1) { e_4 = { error: e_4_1 }; }
                                    finally {
                                        try {
                                            if (values_1_1 && !values_1_1.done && (_b = values_1.return)) _b.call(values_1);
                                        }
                                        finally { if (e_4) throw e_4.error; }
                                    }
                                }
                            }
                        }
                        catch (e_3_1) { e_3 = { error: e_3_1 }; }
                        finally {
                            try {
                                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                            }
                            finally { if (e_3) throw e_3.error; }
                        }
                    });
                    return [4 /*yield*/, new Promise(function (resolve) {
                            return server_1.handleUpgrade(req, req.socket, Buffer.alloc(0), resolve);
                        })];
                case 16:
                    websocket_1 = _d.sent();
                    _a = response.body, onOpen = _a.onOpen, onClose = _a.onClose, onMessage_1 = _a.onMessage, onSendError_1 = _a.onSendError;
                    websocket_1.on('message', function (data) {
                        return sendWebsocketMessages(websocket_1, onMessage_1(data), onSendError_1);
                    });
                    closeReason = void 0;
                    if (!(onOpen === undefined)) return [3 /*break*/, 18];
                    return [4 /*yield*/, new Promise(function (resolve) {
                            // can't just call onClose here in this callback because
                            // it's potentially async and as such needs to be awaited
                            // before the final cleanup is called
                            return websocket_1.on('close', function () {
                                var args = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    args[_i] = arguments[_i];
                                }
                                return resolve(args);
                            });
                        })];
                case 17:
                    closeReason = _d.sent();
                    return [3 /*break*/, 20];
                case 18: return [4 /*yield*/, Promise.all([
                        new Promise(function (resolve) {
                            return websocket_1.on('close', function () {
                                var args = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    args[_i] = arguments[_i];
                                }
                                return resolve(args);
                            });
                        }),
                        // the 'open' even is never fired when running in noServer
                        // mode, so just call onOpen straight away as the request
                        // is already opened
                        sendWebsocketMessages(websocket_1, onOpen(), onSendError_1)
                    ])];
                case 19:
                    _b = tslib_1.__read.apply(void 0, [_d.sent(), 1]), closeReason = _b[0];
                    _d.label = 20;
                case 20:
                    if (!(onClose !== undefined)) return [3 /*break*/, 22];
                    return [4 /*yield*/, onClose.apply(void 0, tslib_1.__spread(closeReason))];
                case 21:
                    _d.sent();
                    _d.label = 22;
                case 22:
                    if (!(cleanup !== undefined)) return [3 /*break*/, 24];
                    return [4 /*yield*/, cleanup(response)];
                case 23:
                    _d.sent();
                    _d.label = 24;
                case 24: return [2 /*return*/];
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