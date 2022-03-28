import type { Result } from 'fallible';
import type { AwaitableRequestListener, ExceptionListener, MessageHandler, SocketMap } from './types.js';
/**
 * Creates a callback intended to be added as a listener to the `request` event
 * of a Node `http` `Server`.
 * @param messageHandler
 * A function which takes a Node `http` `IncomingMessage` and returns a `Response`
 * @param exceptionListener
 * A function called if the message handler throws or if the `ServerResponse`
 * fires an `error` event when writing.
 * If not given, prints a warning and `console.error` is used.
 * @returns
 * The callback, and a map of all active WebSockets identified by UUIDs.
 */
export declare function createRequestListener(messageHandler: MessageHandler, exceptionListener?: ExceptionListener): [AwaitableRequestListener, SocketMap];
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
 * Chains together two message handlers that return `Result` states. If the
 * first handler returns a state of `Error`, it is immediately returned. If it
 * returns `Ok`, its value is passed as the state the second handler. Any
 * cleanup functions returned are combined so that the second handler's cleanup
 * is called before the first's.
 * @param firstHandler
 * @param secondHandler
 * @returns
 */
export declare function composeResultMessageHandlers<StateA, StateB, StateC, ErrorA, ErrorB>(firstHandler: MessageHandler<StateA, Result<StateB, ErrorA>>, secondHandler: MessageHandler<StateB, Result<StateC, ErrorA | ErrorB>>): MessageHandler<StateA, Result<StateC, ErrorA | ErrorB>>;
/**
 * An alternative to `composeMessageHandlers`. Much more elegant when chaining
 * many handlers together. Immutable.
 *
 * The following are equivalent:
 * ```
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
 * An alternative to `composeResultMessageHandlers`. Much more elegant when
 * chaining many handlers together. Immutable.
 *
 * The following are equivalent:
 * ```
 * new ResultMessageHandlerComposer(a)
 *      .intoResultHandler(b)
 *      .intoHandler(c)
 *      .build()
 *
 * composeMessageHandlers(composeResultMessageHandlers(a, b), c)
 * ```
 */
export declare class ResultMessageHandlerComposer<ExistingState, NewState, Error> extends MessageHandlerComposer<ExistingState, Result<NewState, Error>> {
    intoResultHandler<State, ErrorB>(other: MessageHandler<NewState, Result<State, Error | ErrorB>>): ResultMessageHandlerComposer<ExistingState, State, Error | ErrorB>;
}
