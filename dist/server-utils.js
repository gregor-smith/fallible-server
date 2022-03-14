import { TextDecoder } from 'node:util';
import { parse as secureJSONParse } from 'secure-json-parse';
import { error, ok } from 'fallible';
import { Formidable, errors as formidableErrors } from 'formidable';
export async function parseJSONStream(stream, { maximumSize = Infinity, encoding = 'utf-8' } = {}) {
    let size = 0;
    const chunks = [];
    for await (const chunk of stream) {
        size += chunk.byteLength;
        if (size > maximumSize) {
            return error({ tag: 'MaximumSizeExceeded' });
        }
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    let text;
    try {
        text = new TextDecoder(encoding, { fatal: true }).decode(buffer);
    }
    catch (exception) {
        return error({ tag: 'DecodeError', error: exception });
    }
    let value;
    try {
        value = secureJSONParse(text);
    }
    catch {
        return error({ tag: 'InvalidSyntax' });
    }
    return ok(value);
}
// TODO: replace with async generator
export function parseMultipartRequest(request, { encoding, saveDirectory, keepFileExtensions, minimumFileSize = 0, maximumFileCount = Infinity, maximumFileSize = Infinity, maximumFieldsCount = Infinity, maximumFieldsSize = Infinity } = {}) {
    return new Promise(resolve => {
        new Formidable({
            enabledPlugins: ['multipart'],
            encoding,
            keepExtensions: keepFileExtensions,
            uploadDir: saveDirectory,
            allowEmptyFiles: true,
            minFileSize: minimumFileSize,
            maxFiles: maximumFileCount,
            maxFileSize: maximumFileSize,
            maxTotalFileSize: maximumFileCount * maximumFileSize,
            maxFields: maximumFieldsCount,
            maxFieldsSize: maximumFieldsSize
        }).parse(request, (exception, fields, files) => {
            if (exception !== null && exception !== undefined) {
                return resolve(error(getError(exception)));
            }
            const newFiles = {};
            for (const [name, file] of Object.entries(files)) {
                newFiles[name] = {
                    size: file.size,
                    path: file.filepath,
                    mimetype: file.mimetype,
                    dateModified: file.lastModifiedDate
                };
            }
            resolve(ok({
                fields,
                files: newFiles
            }));
        });
    });
}
function getError(error) {
    if (!(error instanceof formidableErrors.default)) {
        return { tag: 'UnknownError', error };
    }
    switch (error.code) {
        case formidableErrors.malformedMultipart:
            return { tag: 'InvalidMultipartContentTypeHeader' };
        case formidableErrors.aborted:
            return { tag: 'RequestAborted' };
        case formidableErrors.maxFilesExceeded:
            return { tag: 'MaximumFileCountExceeded' };
        case formidableErrors.biggerThanMaxFileSize:
            return { tag: 'MaximumFileSizeExceeded' };
        case formidableErrors.biggerThanTotalMaxFileSize:
            return { tag: 'MaximumTotalFileSizeExceeded' };
        case formidableErrors.maxFieldsExceeded:
            return { tag: 'MaximumFieldsCountExceeded' };
        case formidableErrors.maxFieldsSizeExceeded:
            return { tag: 'MaximumFieldsSizeExceeded' };
        case formidableErrors.smallerThanMinFileSize:
            return { tag: 'BelowMinimumFileSize' };
        default:
            return { tag: 'UnknownError', error };
    }
}
//# sourceMappingURL=server-utils.js.map