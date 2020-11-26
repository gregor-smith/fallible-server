"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIsWebSocket = exports.parseAuthorisationBearer = void 0;
var tslib_1 = require("tslib");
var fallible_1 = require("fallible");
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
//# sourceMappingURL=handlers.js.map