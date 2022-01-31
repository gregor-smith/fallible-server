import { join as joinPath } from 'node:path';
import { parse as secureJSONParse } from 'secure-json-parse';
import { asyncFallible, error, ok } from 'fallible';
import { Formidable } from 'formidable';
import sanitiseFilename from 'sanitize-filename';
import { createReadStream, stat } from 'fallible-fs';
export function readBufferStream(request, limit = Number.POSITIVE_INFINITY) {
    if (request.destroyed) {
        return error({ tag: 'StreamClosed' });
    }
    return new Promise(resolve => {
        const chunks = [];
        let length = 0;
        const onData = (chunk) => {
            if (!(chunk instanceof Buffer)) {
                cleanup();
                const result = error({ tag: 'NonBufferChunk', chunk });
                return resolve(result);
            }
            if (request.destroyed) {
                cleanup();
                const result = error({ tag: 'StreamClosed' });
                return resolve(result);
            }
            length += chunk.length;
            if (length > limit) {
                cleanup();
                const result = error({ tag: 'LimitExceeded' });
                return resolve(result);
            }
            chunks.push(chunk);
        };
        const onEnd = () => {
            cleanup();
            const buffer = Buffer.concat(chunks);
            const result = ok(buffer);
            resolve(result);
        };
        const onError = (exception) => {
            cleanup();
            const result = error({
                tag: 'OtherError',
                error: exception
            });
            resolve(result);
        };
        const onClose = () => {
            cleanup();
            const result = error({ tag: 'StreamClosed' });
            resolve(result);
        };
        const cleanup = () => {
            request.off('data', onData);
            request.off('error', onError);
            request.off('end', onEnd);
            request.off('close', onClose);
        };
        request.on('data', onData);
        request.once('end', onEnd);
        request.once('error', onError);
        request.once('close', onClose);
    });
}
export function parseJSONStream(stream, limit) {
    return asyncFallible(async (propagate) => {
        const buffer = propagate(await readBufferStream(stream, limit));
        let text;
        try {
            // not sure if this can throw but just in case
            text = buffer.toString('utf-8');
        }
        catch (exception) {
            return error({ tag: 'OtherError', error: exception });
        }
        let value;
        try {
            value = secureJSONParse(text);
        }
        catch {
            return error({ tag: 'InvalidSyntax' });
        }
        return ok(value);
    });
}
export function parseMultipartStream(stream, { encoding = 'utf-8', saveDirectory, keepFileExtensions, fileSizeLimit, fieldsSizeLimit } = {}) {
    return new Promise(resolve => {
        new Formidable({
            enabledPlugins: ['multipart'],
            encoding,
            keepExtensions: keepFileExtensions,
            uploadDir: saveDirectory,
            maxFieldsSize: fieldsSizeLimit,
            maxFileSize: fileSizeLimit
        }).parse(stream, (exception, fields, files) => {
            if (exception === null || exception === undefined) {
                const newFiles = {};
                for (const [name, file] of Object.entries(files)) {
                    newFiles[name] = {
                        size: file.size,
                        path: file.path,
                        name: file.name,
                        mimetype: file.type,
                        dateModified: file.mtime
                    };
                }
                resolve(ok({
                    fields,
                    files: newFiles
                }));
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
export function openFile(path, encoding) {
    return asyncFallible(async (propagate) => {
        const stats = propagate(await stat(path));
        // this check is necessary because createReadStream fires the ready
        // event before the error event when trying to open a directory
        // see https://github.com/nodejs/node/issues/31583
        if (stats.isDirectory()) {
            return error({ tag: 'IsADirectory' });
        }
        const stream = propagate(await createReadStream(path, encoding));
        return ok({ stream, stats });
    });
}
export function openSanitisedFile(directory, filename, encoding) {
    const path = joinPath(directory, sanitiseFilename(filename));
    return openFile(path, encoding);
}
//# sourceMappingURL=server-utils.js.map