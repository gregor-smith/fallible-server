// This file should have no runtime dependencies on Node modules. Exclusively
// Node-only utils should go in ./server.ts
import * as fallible from 'fallible';
import { parse as parseJSONString } from 'secure-json-parse';
export { parse as parseJSONString } from 'secure-json-parse';
/**
 * Attempts to return the IP of the client the message represents.
 *
 * @param useXForwardedFor
 * If `true`, the `'X-Forwarded-For'` header is respected. Defaults to `false`.
 */
export function getMessageIP(message, useXForwardedFor = false) {
    if (!useXForwardedFor) {
        return message.socket.remoteAddress;
    }
    let header = message.headers['x-forwarded-for'];
    if (Array.isArray(header)) {
        header = header[0];
    }
    return header?.match(/^\s*([^\s]+)\s*(?:,|$)/)?.[1] ?? message.socket.remoteAddress;
}
/**
 * Parses the type and character set from a Content-Type header.
 * If the header has no `charset` directive, the entire header is returned.
 * Both type and characterSet are always returned lower case.
 */
export function parseCharSetContentTypeHeader(header) {
    const match = header.match(/^\s*(.+?)\s*;\s*charset\s*=\s*(")?(.+?)\2\s*$/i);
    if (match === null) {
        header = header.trim();
        if (header.length === 0) {
            return;
        }
        return {
            type: header.toLowerCase()
        };
    }
    const [, type, , characterSet] = match;
    return {
        type: type.toLowerCase(),
        characterSet: characterSet.toLowerCase()
    };
}
/** Parses the integer value of a Content-Length header */
export function parseContentLengthHeader(header) {
    // Passing an all whitespace string to Number gives you 0
    if (!header.match(/[0-9]/)) {
        return;
    }
    const length = Number(header);
    if (!Number.isSafeInteger(length)) {
        return;
    }
    return length;
}
/** Parses the token from a Authorization header with the Bearer scheme */
export function parseAuthorizationHeaderBearer(header) {
    // See: https://datatracker.ietf.org/doc/html/rfc6750#section-2.1
    return header.match(/^Bearer ([a-zA-Z0-9\-\._\~\+\/]+)/)?.[1];
}
/**
 * Returns whether all the headers required for a WebSocket upgrade are present.
 * Does not guarantee that those headers are fully valid - currently this can
 * only be confirmed by returning a {@link webSocketResponse} from a handler.
 */
export function headersIndicateWebSocketRequest(headers) {
    return headers.connection?.toLowerCase() === 'upgrade'
        && headers.upgrade === 'websocket'
        && headers['sec-websocket-key'] !== undefined
        && headers['sec-websocket-version'] !== undefined;
}
export function response(state, cleanup) {
    return { state, cleanup };
}
/** Yields values from an iterable of promises as they resolve */
export async function* iterateAsResolved(promises) {
    const map = new Map();
    let counter = 0;
    for (const promise of promises) {
        const current = counter++;
        map.set(current, promise.then(value => [current, value]));
    }
    for (; counter > 0; counter--) {
        const [current, value] = await Promise.race(map.values());
        yield value;
        map.delete(current);
    }
}
export async function parseJSONStream(stream, { maximumSize = Infinity, encoding = 'utf-8' } = {}) {
    let size = 0;
    const chunks = [];
    for await (const chunk of stream) {
        size += chunk.byteLength;
        if (size > maximumSize) {
            return fallible.error({ tag: 'MaximumSizeExceeded' });
        }
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    let text;
    try {
        text = new TextDecoder(encoding, { fatal: true }).decode(buffer);
    }
    catch (exception) {
        return fallible.error({ tag: 'DecodeError', error: exception });
    }
    let value;
    try {
        value = parseJSONString(text);
    }
    catch {
        return fallible.error({ tag: 'InvalidSyntax' });
    }
    return fallible.ok(value);
}
/**
 * Composes an array of message handlers into one. This new handler calls each
 * of the given handlers in the array until one of them returns a state of
 * type `NewState`, which is returned. If all of them return a state of type
 * `Next`, the state from the given fallback handler is returned instead. Any
 * cleanup functions returned by handlers are combined so that invocation
 * executes them in reverse order. Useful for implementing routing.
 * @param handlers
 * Array of handlers that can return responses of either NewState or Next
 * @param fallback
 * A handler that can only return NewState, used if all of the previous
 * handlers return `NewState`
 * @param isNext
 * A type guard used to identify whether the state returned from a handler is
 * of type `Next`
 */
export function fallthroughMessageHandler(handlers, fallback, isNext) {
    return async (message, state, sockets) => {
        const cleanups = [];
        for (const handler of handlers) {
            const result = await handler(message, state, sockets);
            cleanups.push(result.cleanup);
            if (isNext(result.state)) {
                continue;
            }
            return composeCleanupResponse(result.state, cleanups);
        }
        const result = await fallback(message, state, sockets);
        cleanups.push(result.cleanup);
        return composeCleanupResponse(result.state, cleanups);
    };
}
/**
 * Chains together two message handlers into one. The state returned from the
 * first handler is passed to the second handler. Any cleanup functions
 * returned are combined so that the second handler's cleanup is called before
 * the first's.
 */
export function composeMessageHandlers(firstHandler, secondHandler) {
    return async (message, state, sockets) => {
        const firstResult = await firstHandler(message, state, sockets);
        const secondResult = await secondHandler(message, firstResult.state, sockets);
        return composeCleanupResponse(secondResult.state, [firstResult.cleanup, secondResult.cleanup]);
    };
}
/**
 * Chains together two message handlers that return
 * {@link fallible.Result Result} states. If the first handler returns a state
 * of {@link fallible.Error Error}, it is immediately returned. If it returns
 * {@link fallible.Ok Ok}, its value is passed as the state the second handler.
 * Any cleanup functions returned are combined so that the second handler's
 * cleanup is called before the first's.
 */
export function composeResultMessageHandlers(firstHandler, secondHandler) {
    return async (message, state, sockets) => {
        const firstResult = await firstHandler(message, state, sockets);
        if (!firstResult.state.ok) {
            return firstResult;
        }
        const secondResult = await secondHandler(message, firstResult.state.value, sockets);
        return composeCleanupResponse(secondResult.state, [firstResult.cleanup, secondResult.cleanup]);
    };
}
function composeCleanupResponse(state, cleanups) {
    return response(state, async (state) => {
        for (let index = cleanups.length - 1; index >= 0; index--) {
            const cleanup = cleanups[index];
            if (cleanup === undefined) {
                continue;
            }
            await cleanup(state);
        }
    });
}
/**
 * An alternative to {@link composeMessageHandlers}. Much more elegant when
 * chaining many handlers together. Immutable.
 *
 * The following are equivalent:
 * ```typescript
 * new MessageHandlerComposer(a)
 *      .intoHandler(b)
 *      .intoHandler(c)
 *      .build()
 *
 * composeMessageHandlers(composeMessageHandlers(a, b), c)
 * ```
 */
export class MessageHandlerComposer {
    #handler;
    constructor(handler) {
        this.#handler = handler;
    }
    intoHandler(other) {
        const handler = composeMessageHandlers(this.#handler, other);
        return new MessageHandlerComposer(handler);
    }
    build() {
        return this.#handler;
    }
}
/**
 * An alternative to {@link composeResultMessageHandlers}. Much more elegant
 * when chaining many handlers together. Immutable.
 *
 * The following are equivalent:
 * ```typescript
 * new ResultMessageHandlerComposer(a)
 *      .intoResultHandler(b)
 *      .intoHandler(c)
 *      .build()
 *
 * composeMessageHandlers(composeResultMessageHandlers(a, b), c)
 * ```
 */
export class ResultMessageHandlerComposer extends MessageHandlerComposer {
    intoResultHandler(other) {
        const handler = composeResultMessageHandlers(this.build(), other);
        return new ResultMessageHandlerComposer(handler);
    }
}
//# sourceMappingURL=utils.js.map