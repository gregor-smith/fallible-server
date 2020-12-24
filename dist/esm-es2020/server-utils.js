import { join as joinPath } from 'path';
import { asyncFallible, error, ok } from 'fallible';
import { Formidable } from 'formidable';
import rawBody from 'raw-body';
import { createReadStream, stat } from 'fallible-fs';
import sanitiseFilename from 'sanitize-filename';
import { parseJSONString } from './general-utils';
function hasTypeField(value) {
    return typeof value === 'object'
        && value !== null
        && 'type' in value;
}
export async function parseJSONStream(stream, { sizeLimit, encoding = 'utf-8', parser = parseJSONString } = {}) {
    let body;
    try {
        body = await rawBody(stream, {
            encoding,
            limit: sizeLimit
        });
    }
    catch (exception) {
        return error(hasTypeField(exception) && exception.type === 'entity.too.large'
            ? { tag: 'TooLarge' }
            : { tag: 'OtherError', error: exception });
    }
    const result = parser(body);
    return result.ok
        ? result
        : error({ tag: 'InvalidSyntax' });
}
export function parseMultipartStream(stream, { encoding = 'utf-8', saveDirectory, keepFileExtensions, fileSizeLimit, fieldsSizeLimit } = {}) {
    const form = new Formidable({
        enabledPlugins: ['multipart'],
        encoding,
        keepExtensions: keepFileExtensions,
        uploadDir: saveDirectory,
        maxFieldsSize: fieldsSizeLimit,
        maxFileSize: fileSizeLimit
    });
    return new Promise(resolve => {
        form.parse(stream, (exception, fields, files) => {
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
}
export function openFile(directory, filename) {
    const path = filename === undefined
        ? directory
        : joinPath(directory, sanitiseFilename(filename));
    return asyncFallible(async (propagate) => {
        const stats = propagate(await stat(path));
        // this check is necessary because createReadStream fires the ready
        // event before the error event when trying to open a directory
        // see https://github.com/nodejs/node/issues/31583
        if (stats.isDirectory()) {
            return error({ tag: 'IsADirectory' });
        }
        const stream = propagate(await createReadStream(path));
        return ok({
            stream,
            length: stats.size
        });
    });
}
//# sourceMappingURL=server-utils.js.map