/// <reference types="node" />
import * as fallible from 'fallible';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import type { AwaitableIterable, Cleanup, MessageHandlerResult, WebSocketBody, WebSocketResponse, MessageHandler } from './types.js';
export { parse as parseJSONString } from 'secure-json-parse';
export declare const enum WebSocketReadyState {
    Connecting = 0,
    Open = 1,
    Closing = 2,
    Closed = 3
}
export interface IncomingMessageIPFields {
    headers: IncomingMessage['headers'];
    socket: Pick<IncomingMessage['socket'], 'remoteAddress'>;
}
/**
 * Attempts to return the IP of the client the message represents.
 *
 * @param useXForwardedFor
 * If `true`, the `'X-Forwarded-For'` header is respected. Defaults to `false`.
 */
export declare function getMessageIP(message: IncomingMessageIPFields, useXForwardedFor?: boolean): string | undefined;
export declare type ParsedContentType = {
    type: string;
    characterSet?: string;
};
/**
 * Parses the type and character set from a Content-Type header.
 * If the header has no `charset` directive, the entire header is returned.
 * Both type and characterSet are always returned lower case.
 */
export declare function parseCharSetContentTypeHeader(header: string): ParsedContentType | undefined;
/** Parses the integer value of a Content-Length header */
export declare function parseContentLengthHeader(header: string): number | undefined;
/** Parses the token from a Authorization header with the Bearer scheme */
export declare function parseAuthorizationHeaderBearer(header: string): string | undefined;
declare type WebSocketHeaders = Pick<IncomingHttpHeaders, 'connection' | 'upgrade' | 'sec-websocket-key' | 'sec-websocket-version'>;
/**
 * Returns whether all the headers required for a WebSocket upgrade are present.
 * Does not guarantee that those headers are fully valid - currently this can
 * only be confirmed by returning a {@link webSocketResponse} from a handler.
 */
export declare function headersIndicateWebSocketRequest(headers: WebSocketHeaders): boolean;
export declare function response<T extends void>(state?: T): MessageHandlerResult<T>;
export declare function response<T>(state: T, cleanup?: Cleanup): MessageHandlerResult<T>;
export declare function webSocketResponse(body: WebSocketBody, cleanup?: Cleanup): MessageHandlerResult<WebSocketResponse>;
/** Yields values from an iterable of promises as they resolve */
export declare function iterateAsResolved<T>(promises: Iterable<PromiseLike<T>>): AsyncGenerator<T, void, unknown>;
export declare type ParseJSONStreamError = {
    tag: 'MaximumSizeExceeded';
} | {
    tag: 'DecodeError';
    error: unknown;
} | {
    tag: 'InvalidSyntax';
};
export declare type ParseJSONStreamOptions = {
    /**
     * Limits the maximum size of the stream; if this limit is exceeded,
     * an {@link ParseJSONStreamError error} is returned. By default unlimited.
     */
    maximumSize?: number;
    /**
     * Defaults to `utf-8`. If decoding fails, an
     * {@link ParseJSONStreamError error} is returned
     */
    encoding?: BufferEncoding;
};
export declare function parseJSONStream(stream: AwaitableIterable<Uint8Array>, { maximumSize, encoding }?: ParseJSONStreamOptions): Promise<fallible.Result<unknown, ParseJSONStreamError>>;
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
export declare function fallthroughMessageHandler<ExistingState, NewState, Next>(handlers: ReadonlyArray<MessageHandler<ExistingState, NewState | Next>>, fallback: MessageHandler<ExistingState, NewState>, isNext: (state: Readonly<NewState | Next>) => state is Next): MessageHandler<ExistingState, NewState>;
/**
 * Chains together two message handlers into one. The state returned from the
 * first handler is passed to the second handler. Any cleanup functions
 * returned are combined so that the second handler's cleanup is called before
 * the first's.
 */
export declare function composeMessageHandlers<StateA, StateB, StateC>(firstHandler: MessageHandler<StateA, StateB>, secondHandler: MessageHandler<StateB, StateC>): MessageHandler<StateA, StateC>;
/**
 * Chains together two message handlers that return
 * {@link fallible.Result Result} states. If the first handler returns a state
 * of {@link fallible.Error Error}, it is immediately returned. If it returns
 * {@link fallible.Ok Ok}, its value is passed as the state the second handler.
 * Any cleanup functions returned are combined so that the second handler's
 * cleanup is called before the first's.
 */
export declare function composeResultMessageHandlers<StateA, StateB, StateC, ErrorA, ErrorB>(firstHandler: MessageHandler<StateA, fallible.Result<StateB, ErrorA>>, secondHandler: MessageHandler<StateB, fallible.Result<StateC, ErrorA | ErrorB>>): MessageHandler<StateA, fallible.Result<StateC, ErrorA | ErrorB>>;
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
export declare class MessageHandlerComposer<ExistingState, NewState> {
    #private;
    constructor(handler: MessageHandler<ExistingState, NewState>);
    intoHandler<State>(other: MessageHandler<NewState, State>): MessageHandlerComposer<ExistingState, State>;
    build(): MessageHandler<ExistingState, NewState>;
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
export declare class ResultMessageHandlerComposer<ExistingState, NewState, Error> extends MessageHandlerComposer<ExistingState, fallible.Result<NewState, Error>> {
    intoResultHandler<State, ErrorB>(other: MessageHandler<NewState, fallible.Result<State, Error | ErrorB>>): ResultMessageHandlerComposer<ExistingState, State, Error | ErrorB>;
}
