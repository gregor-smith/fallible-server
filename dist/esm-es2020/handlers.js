import { asyncFallible, error, ok } from 'fallible';
import { Formidable } from 'formidable';
import rawBody from 'raw-body';
import { parse as secureJSONParse } from 'secure-json-parse';
import { createReadStream, stat } from 'fallible-fs';
function hasTypeField(value) {
    return typeof value === 'object'
        && value !== null
        && 'type' in value;
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
                    body: {
                        json: error(hasTypeField(exception) && exception.type === 'entity.too.large'
                            ? { tag: 'TooLarge' }
                            : { tag: 'OtherError', error: exception })
                    }
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
                    body: {
                        json: error({ tag: 'InvalidSyntax' })
                    }
                }
            });
        }
        return ok({
            state: {
                ...state,
                body: {
                    json: ok(json)
                }
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
                }
                resolve(error({ tag: 'OtherError', error: exception }));
            });
        });
        return ok({
            state: {
                ...state,
                body: {
                    multipart: body
                }
            }
        });
    };
}
export function sendFile() {
    return async (_, state) => {
        const file = await asyncFallible(async (propagate) => {
            const stats = propagate(await stat(state.sendFile.path));
            // this check is necessary because createReadStream fires the ready
            // event before the error event when trying to open a directory
            // see https://github.com/nodejs/node/issues/31583
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