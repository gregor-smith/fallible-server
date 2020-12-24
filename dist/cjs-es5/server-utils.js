"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openFile = exports.parseMultipartStream = exports.parseJSONStream = void 0;
var tslib_1 = require("tslib");
var path_1 = require("path");
var fallible_1 = require("fallible");
var formidable_1 = require("formidable");
var raw_body_1 = tslib_1.__importDefault(require("raw-body"));
var fallible_fs_1 = require("fallible-fs");
var sanitize_filename_1 = tslib_1.__importDefault(require("sanitize-filename"));
var general_utils_1 = require("./general-utils");
function hasTypeField(value) {
    return typeof value === 'object'
        && value !== null
        && 'type' in value;
}
function parseJSONStream(stream, _a) {
    var _b = _a === void 0 ? {} : _a, sizeLimit = _b.sizeLimit, _c = _b.encoding, encoding = _c === void 0 ? 'utf-8' : _c, _d = _b.parser, parser = _d === void 0 ? general_utils_1.parseJSONString : _d;
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var body, exception_1, result;
        return tslib_1.__generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, raw_body_1.default(stream, {
                            encoding: encoding,
                            limit: sizeLimit
                        })];
                case 1:
                    body = _e.sent();
                    return [3 /*break*/, 3];
                case 2:
                    exception_1 = _e.sent();
                    return [2 /*return*/, fallible_1.error(hasTypeField(exception_1) && exception_1.type === 'entity.too.large'
                            ? { tag: 'TooLarge' }
                            : { tag: 'OtherError', error: exception_1 })];
                case 3:
                    result = parser(body);
                    return [2 /*return*/, result.ok
                            ? result
                            : fallible_1.error({ tag: 'InvalidSyntax' })];
            }
        });
    });
}
exports.parseJSONStream = parseJSONStream;
function parseMultipartStream(stream, _a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.encoding, encoding = _c === void 0 ? 'utf-8' : _c, saveDirectory = _b.saveDirectory, keepFileExtensions = _b.keepFileExtensions, fileSizeLimit = _b.fileSizeLimit, fieldsSizeLimit = _b.fieldsSizeLimit;
    var form = new formidable_1.Formidable({
        enabledPlugins: ['multipart'],
        encoding: encoding,
        keepExtensions: keepFileExtensions,
        uploadDir: saveDirectory,
        maxFieldsSize: fieldsSizeLimit,
        maxFileSize: fileSizeLimit
    });
    return new Promise(function (resolve) {
        form.parse(stream, function (exception, fields, files) {
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
            }
            resolve(fallible_1.error({ tag: 'OtherError', error: exception }));
        });
    });
}
exports.parseMultipartStream = parseMultipartStream;
function openFile(directory, filename) {
    var _this = this;
    var path = filename === undefined
        ? directory
        : path_1.join(directory, sanitize_filename_1.default(filename));
    return fallible_1.asyncFallible(function (propagate) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var stats, _a, stream, _b;
        return tslib_1.__generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = propagate;
                    return [4 /*yield*/, fallible_fs_1.stat(path)];
                case 1:
                    stats = _a.apply(void 0, [_c.sent()]);
                    // this check is necessary because createReadStream fires the ready
                    // event before the error event when trying to open a directory
                    // see https://github.com/nodejs/node/issues/31583
                    if (stats.isDirectory()) {
                        return [2 /*return*/, fallible_1.error({ tag: 'IsADirectory' })];
                    }
                    _b = propagate;
                    return [4 /*yield*/, fallible_fs_1.createReadStream(path)];
                case 2:
                    stream = _b.apply(void 0, [_c.sent()]);
                    return [2 /*return*/, fallible_1.ok({
                            stream: stream,
                            length: stats.size
                        })];
            }
        });
    }); });
}
exports.openFile = openFile;
//# sourceMappingURL=server-utils.js.map