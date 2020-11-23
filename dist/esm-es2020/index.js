import Cookies from 'cookies';
import { asyncFallible, ok, error } from 'fallible';
function parseQueryString(queryString) {
    if (queryString === undefined) {
        return {};
    }
    const query = {};
    for (const pair of queryString.split('&')) {
        let [key, value] = pair.split('=');
        if (value === undefined) {
            continue;
        }
        key = decodeURIComponent(key);
        value = decodeURIComponent(value);
        query[key] = value;
    }
    return query;
}
function parseHash(hash) {
    if (hash === undefined) {
        return '';
    }
    return decodeURIComponent(hash);
}
function parsePath(path) {
    const segments = [];
    for (let segment of path.split('/')) {
        segment = decodeURIComponent(segment);
        if (segment.length === 0) {
            continue;
        }
        segments.push(segment);
    }
    return segments;
}
function parseURL(url) {
    const match = /^(?:(.+)\?(.+)#(.+)|(.+)\?(.+)|(.+)#(.+))/.exec(url);
    return match === null
        ? {
            path: parsePath(url),
            query: {},
            hash: ''
        }
        : {
            path: parsePath(match[6] ?? match[4] ?? match[1] ?? url),
            query: parseQueryString(match[5] ?? match[2]),
            hash: parseHash(match[7] ?? match[3])
        };
}
function parseContentType(contentType) {
    if (contentType === undefined) {
        return undefined;
    }
    const match = /^\s*(.+?)\s*;\s*charset\s*=\s*(")?(.+?)\2\s*$/i.exec(contentType);
    if (match == null) {
        contentType = contentType.trim();
        if (contentType.length === 0) {
            return undefined;
        }
        return {
            type: contentType.toLowerCase()
        };
    }
    const [, type, , characterSet] = match;
    return {
        type: type.toLowerCase(),
        characterSet: characterSet.toLowerCase()
    };
}
export class Request {
    constructor({ getCookie, behindProxy, ip, method, headers, url }) {
        this.cookie = getCookie;
        this.behindProxy = behindProxy;
        this._ip = ip;
        this.method = method;
        this.headers = headers;
        this.url = url;
    }
    header(key) {
        const header = this.headers[key];
        return Array.isArray(header)
            ? header[0]
            : header;
    }
    get parsedContentType() {
        return this._parsedContentType ?? (this._parsedContentType = parseContentType(this.headers['content-type']));
    }
    get parsedURL() {
        return this._parsedURL ?? (this._parsedURL = parseURL(this.url));
    }
    get path() {
        return this.parsedURL.path;
    }
    get query() {
        return this.parsedURL.query;
    }
    get hash() {
        return this.parsedURL.hash;
    }
    get contentLength() {
        const length = Number(this.headers['content-length']);
        return Number.isNaN(length) ? undefined : length;
    }
    get contentType() {
        return this.parsedContentType?.type;
    }
    get characterSet() {
        return this.parsedContentType?.characterSet;
    }
    get ip() {
        if (!this.behindProxy) {
            return this._ip;
        }
        const header = this.header('x-forwarded-for');
        return header?.match(/^(.+?),/)?.[1]
            ?.trim()
            ?? header?.trim()
            ?? this._ip;
    }
}
export function defaultErrorHandler() {
    return {
        status: 500,
        body: 'Internal server error'
    };
}
export function defaultResponseHandler() {
    return ok({
        status: 200,
        body: ''
    });
}
export function createRequestListener({ secretKey, behindProxy = false, requestHandler, responseHandler = defaultResponseHandler, errorHandler = defaultErrorHandler }) {
    return async (req, res) => {
        const cookies = Cookies(req, res, { keys: [secretKey] });
        const request = new Request({
            getCookie: key => cookies.get(key, { signed: true }),
            behindProxy,
            headers: req.headers,
            ip: req.connection.remoteAddress ?? req.socket.remoteAddress,
            method: req.method?.toUpperCase() ?? 'GET',
            url: req.url ?? '/'
        });
        let response;
        try {
            const result = await asyncFallible(async (propagate) => {
                const { state, cleanup } = propagate(await requestHandler(request, {}));
                const response = propagate(await responseHandler(state));
                if (cleanup !== undefined) {
                    propagate(await cleanup(response));
                }
                return ok(response);
            });
            response = result.ok
                ? result.value
                : await errorHandler(result.value);
        }
        catch {
            response = defaultErrorHandler();
        }
        res.statusCode = response.status ?? 200;
        if (response.cookies !== undefined) {
            for (const [key, { value, ...options }] of Object.entries(response.cookies)) {
                cookies.set(key, value, options);
            }
        }
        if (response.headers !== undefined) {
            for (const [key, value] of Object.entries(response.headers)) {
                res.setHeader(key, value);
            }
        }
        if (typeof response.body === 'string') {
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', Buffer.byteLength(response.body));
            }
            res.end(response.body);
        }
        else if (response.body instanceof Buffer) {
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/octet-stream');
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', response.body.length);
            }
            res.end(response.body);
        }
        else if (response.body !== undefined) {
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/octet-stream');
            }
            response.body.pipe(res);
        }
        else {
            res.end();
        }
    };
}
async function composeCleanups(cleanups, response, composeErrors) {
    const errors = [];
    for (let index = cleanups.length; index >= 0; index--) {
        const result = await cleanups[index](response);
        if (!result.ok) {
            errors.push(result.value);
        }
    }
    if (errors.length !== 0) {
        const composed = await composeErrors(errors);
        return error(composed);
    }
    return ok(undefined);
}
export function composeRequestHandlers(handlers, composeCleanupErrors) {
    return async (request, state) => {
        const cleanups = [];
        for (const handler of handlers) {
            const result = await handler(request, state);
            if (!result.ok) {
                return asyncFallible(async (propagate) => {
                    propagate(await composeCleanups(cleanups, undefined, composeCleanupErrors));
                    return result;
                });
            }
            state = result.value.state;
            if (result.value.cleanup !== undefined) {
                cleanups.push(result.value.cleanup);
            }
        }
        return ok({
            state,
            cleanup: response => composeCleanups(cleanups, response, composeCleanupErrors)
        });
    };
}
//# sourceMappingURL=index.js.map