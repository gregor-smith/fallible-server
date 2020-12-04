"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendFile = exports.parseMultipartBody = exports.parseJSONBody = exports.getIsWebSocket = exports.parseAuthorisationBearer = void 0;
var tslib_1 = require("tslib");
var fallible_1 = require("fallible");
var formidable_1 = require("formidable");
var raw_body_1 = tslib_1.__importDefault(require("raw-body"));
var secure_json_parse_1 = require("secure-json-parse");
var fallible_fs_1 = require("fallible-fs");
var mime_types_1 = require("mime-types");
var utils_1 = require("./utils");
function parseAuthorisationBearer() {
    return function (message, state) {
        var _a;
        var authorisationToken;
        var header = utils_1.getMessageHeader(message, 'Authorization');
        if (header === undefined) {
            authorisationToken = fallible_1.error('HeaderMissing');
        }
        else {
            var token = (_a = header.match(/^Bearer (.+)/)) === null || _a === void 0 ? void 0 : _a[1];
            authorisationToken = token === undefined
                ? fallible_1.error('HeaderInvalid')
                : fallible_1.ok(token);
        }
        return fallible_1.ok({
            state: tslib_1.__assign(tslib_1.__assign({}, state), { authorisationToken: authorisationToken })
        });
    };
}
exports.parseAuthorisationBearer = parseAuthorisationBearer;
function getIsWebSocket() {
    return function (message, state) {
        return fallible_1.ok({
            state: tslib_1.__assign(tslib_1.__assign({}, state), { isWebSocket: utils_1.getMessageHeader(message, 'upgrade') === 'websocket' })
        });
    };
}
exports.getIsWebSocket = getIsWebSocket;
function hasTypeField(value) {
    return typeof value === 'object'
        && value !== null
        && 'type' in value
        && typeof value.type === 'string';
}
function parseJSONBody(_a) {
    var _this = this;
    var _b = _a === void 0 ? {} : _a, sizeLimit = _b.sizeLimit, _c = _b.encoding, encoding = _c === void 0 ? 'utf-8' : _c, _d = _b.parser, parser = _d === void 0 ? secure_json_parse_1.parse : _d;
    return function (message, state) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var body, exception_1, json;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, raw_body_1.default(message, {
                            encoding: encoding,
                            limit: sizeLimit
                        })];
                case 1:
                    body = _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    exception_1 = _a.sent();
                    return [2 /*return*/, fallible_1.ok({
                            state: tslib_1.__assign(tslib_1.__assign({}, state), { body: fallible_1.error(hasTypeField(exception_1) && exception_1.type === 'entity.too.large'
                                    ? { tag: 'TooLarge' }
                                    : { tag: 'OtherError', error: exception_1 }) })
                        })];
                case 3:
                    try {
                        json = parser(body);
                    }
                    catch (_b) {
                        return [2 /*return*/, fallible_1.ok({
                                state: tslib_1.__assign(tslib_1.__assign({}, state), { body: fallible_1.error({ tag: 'InvalidSyntax' }) })
                            })];
                    }
                    return [2 /*return*/, fallible_1.ok({
                            state: tslib_1.__assign(tslib_1.__assign({}, state), { body: fallible_1.ok(json) })
                        })];
            }
        });
    }); };
}
exports.parseJSONBody = parseJSONBody;
function parseMultipartBody(_a) {
    var _this = this;
    var _b = _a === void 0 ? {} : _a, _c = _b.encoding, encoding = _c === void 0 ? 'utf-8' : _c, saveDirectory = _b.saveDirectory, keepFileExtensions = _b.keepFileExtensions, fileSizeLimit = _b.fileSizeLimit, fieldsSizeLimit = _b.fieldsSizeLimit;
    return function (message, state) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var form, body;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    form = new formidable_1.Formidable({
                        enabledPlugins: ['multipart'],
                        encoding: encoding,
                        keepExtensions: keepFileExtensions,
                        uploadDir: saveDirectory,
                        maxFieldsSize: fieldsSizeLimit,
                        maxFileSize: fileSizeLimit
                    });
                    return [4 /*yield*/, new Promise(function (resolve) {
                            form.parse(message, function (exception, fields, files) {
                                if (exception === null || exception === undefined) {
                                    resolve(fallible_1.ok({ fields: fields, files: files }));
                                    return;
                                }
                                if (exception instanceof Error) {
                                    if (/maxFieldsSize/.test(exception.message)) {
                                        resolve(fallible_1.error({ tag: 'FieldsTooLarge' }));
                                        return;
                                    }
                                    if (/maxFileSize/.test(exception.message)) {
                                        resolve(fallible_1.error({ tag: 'FilesTooLarge' }));
                                        return;
                                    }
                                    resolve(fallible_1.error({ tag: 'OtherError', error: exception }));
                                    return;
                                }
                                resolve(fallible_1.error({ tag: 'OtherError', error: exception }));
                            });
                        })];
                case 1:
                    body = _a.sent();
                    return [2 /*return*/, fallible_1.ok({
                            state: tslib_1.__assign(tslib_1.__assign({}, state), { body: body })
                        })];
            }
        });
    }); };
}
exports.parseMultipartBody = parseMultipartBody;
function sendFile(_a) {
    var _this = this;
    var maxAge = _a.maxAge, _b = _a.immutable, immutable = _b === void 0 ? false : _b;
    return function (_, state) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        var _c, _d;
        var _this = this;
        return tslib_1.__generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _a = fallible_1.ok;
                    _c = {};
                    _b = [tslib_1.__assign({}, state)];
                    _d = {};
                    return [4 /*yield*/, fallible_1.asyncFallible(function (propagate) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var stats, _a, stream, _b, directives;
                            var _c, _d;
                            return tslib_1.__generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0:
                                        _a = propagate;
                                        return [4 /*yield*/, fallible_fs_1.stat(state.sendFile.path)];
                                    case 1:
                                        stats = _a.apply(void 0, [_e.sent()]);
                                        if (stats.isDirectory()) {
                                            return [2 /*return*/, fallible_1.error({ tag: 'IsADirectory' })];
                                        }
                                        _b = propagate;
                                        return [4 /*yield*/, fallible_fs_1.createReadStream(state.sendFile.path)];
                                    case 2:
                                        stream = _b.apply(void 0, [_e.sent()]);
                                        directives = [];
                                        if (maxAge !== undefined) {
                                            directives.push("max-age=" + maxAge);
                                        }
                                        if (immutable) {
                                            directives.push('immutable');
                                        }
                                        return [2 /*return*/, fallible_1.ok({
                                                stream: stream,
                                                headers: {
                                                    'Content-Length': (_c = state.sendFile.contentLength) !== null && _c !== void 0 ? _c : stats.size,
                                                    'Content-Type': (_d = state.sendFile.contentType) !== null && _d !== void 0 ? _d : (mime_types_1.contentType(state.sendFile.path)
                                                        || undefined),
                                                    'Cache-Control': directives.length === 0
                                                        ? undefined
                                                        : directives.join(',')
                                                }
                                            })];
                                }
                            });
                        }); })];
                case 1: return [2 /*return*/, _a.apply(void 0, [(_c.state = tslib_1.__assign.apply(void 0, _b.concat([(_d.file = _e.sent(), _d)])),
                            _c)])];
            }
        });
    }); };
}
exports.sendFile = sendFile;
//# sourceMappingURL=handlers.js.map