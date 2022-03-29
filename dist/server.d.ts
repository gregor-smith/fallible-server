import type * as fallible from 'fallible';
import type * as types from './types.js';
/**
 * Creates a callback intended to be added as a listener to the `request` event
 * of an {@link http.Server}.
 * @param messageHandler
 * A function that takes an {@link http.IncomingMessage IncomingMessage} and
 * returns a {@link types.MessageHandlerResult MessageHandlerResult}. The
 * result may include a {@link types.Cleanup cleanup} function, which is always
 * called after the request has ended, regardless of whether any exceptions
 * occurred. The `Content-Type` header is set by default depending on type of
 * the {@link types.Response response} body: `string` bodies default to
 * `text/html; charset=utf8` while {@link Uint8Array} and
 * {@link types.StreamBody stream} bodies default to `application/octet-stream`.
 * The 'Content-Length' header is also set for all except stream and WebSocket
 * bodies.
 *
 * @param exceptionListener
 * A function called when the message handler throws or the
 * {@link http.ServerResponse ServerResponse} fires an `error` event. If not
 * given, a warning is printed and {@link console.error} is used.
 * @returns
 * The callback, and a map of all active WebSockets identified by UUIDs.
 */
export declare function createRequestListener(messageHandler: types.MessageHandler, exceptionListener?: types.ExceptionListener): [types.AwaitableRequestListener, types.SocketMap];
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
export declare function fallthroughMessageHandler<ExistingState, NewState, Next>(handlers: ReadonlyArray<types.MessageHandler<ExistingState, NewState | Next>>, fallback: types.MessageHandler<ExistingState, NewState>, isNext: (state: Readonly<NewState | Next>) => state is Next): types.MessageHandler<ExistingState, NewState>;
/**
 * Chains together two message handlers into one. The state returned from the
 * first handler is passed to the second handler. Any cleanup functions
 * returned are combined so that the second handler's cleanup is called before
 * the first's.
 */
export declare function composeMessageHandlers<StateA, StateB, StateC>(firstHandler: types.MessageHandler<StateA, StateB>, secondHandler: types.MessageHandler<StateB, StateC>): types.MessageHandler<StateA, StateC>;
/**
 * Chains together two message handlers that return
 * {@link fallible.Result Result} states. If the first handler returns a state
 * of {@link fallible.Error Error}, it is immediately returned. If it returns
 * {@link fallible.Ok Ok}, its value is passed as the state the second handler.
 * Any cleanup functions returned are combined so that the second handler's
 * cleanup is called before the first's.
 */
export declare function composeResultMessageHandlers<StateA, StateB, StateC, ErrorA, ErrorB>(firstHandler: types.MessageHandler<StateA, fallible.Result<StateB, ErrorA>>, secondHandler: types.MessageHandler<StateB, fallible.Result<StateC, ErrorA | ErrorB>>): types.MessageHandler<StateA, fallible.Result<StateC, ErrorA | ErrorB>>;
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
    constructor(handler: types.MessageHandler<ExistingState, NewState>);
    intoHandler<State>(other: types.MessageHandler<NewState, State>): MessageHandlerComposer<ExistingState, State>;
    build(): types.MessageHandler<ExistingState, NewState>;
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
    intoResultHandler<State, ErrorB>(other: types.MessageHandler<NewState, fallible.Result<State, Error | ErrorB>>): ResultMessageHandlerComposer<ExistingState, State, Error | ErrorB>;
}
