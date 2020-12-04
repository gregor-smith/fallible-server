import { asyncFallible, error, ok } from 'fallible';
import { Formidable } from 'formidable';
import rawBody from 'raw-body';
import { parse as secureJSONParse } from 'secure-json-parse';
import { createReadStream, stat } from 'fallible-fs';
import { getMessageHeader } from './utils';
export function parseAuthorisationBearer() {
    return (message, state) => {
        let authorisationToken;
        const header = getMessageHeader(message, 'Authorization');
        if (header === undefined) {
            authorisationToken = error('HeaderMissing');
        }
        else {
            const token = header.match(/^Bearer (.+)/)?.[1];
            authorisationToken = token === undefined
                ? error('HeaderInvalid')
                : ok(token);
        }
        return ok({
            state: {
                ...state,
                authorisationToken
            }
        });
    };
}
export function getIsWebSocket() {
    return (message, state) => ok({
        state: {
            ...state,
            isWebSocket: getMessageHeader(message, 'upgrade') === 'websocket'
        }
    });
}
function hasTypeField(value) {
    return typeof value === 'object'
        && value !== null
        && 'type' in value
        && typeof value.type === 'string';
}
export function parseJSONBody({ sizeLimit, encoding = 'utf-8', parser = secureJSONParse } = {}) {
    return async (message, state) => {
        let body;
        try {
            body = await rawBody(message, {
                encoding,
                limit: sizeLimit
            });
        }
        catch (exception) {
            return ok({
                state: {
                    ...state,
                    body: error(hasTypeField(exception) && exception.type === 'entity.too.large'
                        ? { tag: 'TooLarge' }
                        : { tag: 'OtherError', error: exception })
                }
            });
        }
        let json;
        try {
            json = parser(body);
        }
        catch {
            return ok({
                state: {
                    ...state,
                    body: error({ tag: 'InvalidSyntax' })
                }
            });
        }
        return ok({
            state: {
                ...state,
                body: ok(json)
            }
        });
    };
}
export function parseMultipartBody({ encoding = 'utf-8', saveDirectory, keepFileExtensions, fileSizeLimit, fieldsSizeLimit } = {}) {
    return async (message, state) => {
        const form = new Formidable({
            enabledPlugins: ['multipart'],
            encoding,
            keepExtensions: keepFileExtensions,
            uploadDir: saveDirectory,
            maxFieldsSize: fieldsSizeLimit,
            maxFileSize: fileSizeLimit
        });
        const body = await new Promise(resolve => {
            form.parse(message, (exception, fields, files) => {
                if (exception === null || exception === undefined) {
                    resolve(ok({ fields, files }));
                    return;
                }
                if (exception instanceof Error) {
                    if (/maxFieldsSize/.test(exception.message)) {
                        resolve(error({ tag: 'FieldsTooLarge' }));
                        return;
                    }
                    if (/maxFileSize/.test(exception.message)) {
                        resolve(error({ tag: 'FilesTooLarge' }));
                        return;
                    }
                    resolve(error({ tag: 'OtherError', error: exception }));
                    return;
                }
                resolve(error({ tag: 'OtherError', error: exception }));
            });
        });
        return ok({
            state: {
                ...state,
                body
            }
        });
    };
}
export function sendFile() {
    return async (_, state) => {
        const file = await asyncFallible(async (propagate) => {
            const stats = propagate(await stat(state.sendFile.path));
            if (stats.isDirectory()) {
                return error({ tag: 'IsADirectory' });
            }
            const stream = propagate(await createReadStream(state.sendFile.path));
            return ok({
                stream,
                contentLength: stats.size
            });
        });
        return ok({
            state: {
                ...state,
                sendFile: { ...state.sendFile, file }
            }
        });
    };
}
//# sourceMappingURL=handlers.js.map