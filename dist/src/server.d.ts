import Websocket from 'ws';
import { Awaitable } from 'fallible';
import type { AwaitableRequestListener, ErrorHandler, ExceptionHandler, MessageHandler, Response } from './types';
export declare function defaultErrorHandler(): Response;
export declare function defaultOnWebsocketSendError(_: Websocket.Data, { name, message }: Error): Awaitable<void>;
export declare type CreateRequestListenerArguments<Errors> = {
    messageHandler: MessageHandler<void, Response, Errors>;
    errorHandler?: ErrorHandler<Errors>;
    exceptionHandler?: ExceptionHandler;
};
export declare function createRequestListener<Errors>({ messageHandler, errorHandler, exceptionHandler }: CreateRequestListenerArguments<Errors>): AwaitableRequestListener;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3>(handlers: [
    MessageHandler<State1, State2, Exclude<Error1, never>>,
    MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>
]): MessageHandler<State1, State3, Exclude<Error1 | Error2, never>>;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4>(handlers: [
    MessageHandler<State1, State2, Exclude<Error1, never>>,
    MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>,
    MessageHandler<State3, State4, Exclude<Error1 | Error2 | Error3, never>>
]): MessageHandler<State1, State4, Exclude<Error1 | Error2 | Error3, never>>;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5>(handlers: [
    MessageHandler<State1, State2, Exclude<Error1, never>>,
    MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>,
    MessageHandler<State3, State4, Exclude<Error1 | Error2 | Error3, never>>,
    MessageHandler<State4, State5, Exclude<Error1 | Error2 | Error3 | Error4, never>>
]): MessageHandler<State1, State5, Exclude<Error1 | Error2 | Error3 | Error4, never>>;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6>(handlers: [
    MessageHandler<State1, State2, Exclude<Error1, never>>,
    MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>,
    MessageHandler<State3, State4, Exclude<Error1 | Error2 | Error3, never>>,
    MessageHandler<State4, State5, Exclude<Error1 | Error2 | Error3 | Error4, never>>,
    MessageHandler<State5, State6, Exclude<Error1 | Error2 | Error3 | Error4 | Error5, never>>
]): MessageHandler<State1, State6, Exclude<Error1 | Error2 | Error3 | Error4 | Error5, never>>;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6, Error6, State7>(handlers: [
    MessageHandler<State1, State2, Exclude<Error1, never>>,
    MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>,
    MessageHandler<State3, State4, Exclude<Error1 | Error2 | Error3, never>>,
    MessageHandler<State4, State5, Exclude<Error1 | Error2 | Error3 | Error4, never>>,
    MessageHandler<State5, State6, Exclude<Error1 | Error2 | Error3 | Error4 | Error5, never>>,
    MessageHandler<State6, State7, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6, never>>
]): MessageHandler<State1, State7, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6, never>>;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6, Error6, State7, Error7, State8>(handlers: [
    MessageHandler<State1, State2, Exclude<Error1, never>>,
    MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>,
    MessageHandler<State3, State4, Exclude<Error1 | Error2 | Error3, never>>,
    MessageHandler<State4, State5, Exclude<Error1 | Error2 | Error3 | Error4, never>>,
    MessageHandler<State5, State6, Exclude<Error1 | Error2 | Error3 | Error4 | Error5, never>>,
    MessageHandler<State6, State7, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6, never>>,
    MessageHandler<State7, State8, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7, never>>
]): MessageHandler<State1, State8, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7, never>>;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6, Error6, State7, Error7, State8, Error8, State9>(handlers: [
    MessageHandler<State1, State2, Exclude<Error1, never>>,
    MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>,
    MessageHandler<State3, State4, Exclude<Error1 | Error2 | Error3, never>>,
    MessageHandler<State4, State5, Exclude<Error1 | Error2 | Error3 | Error4, never>>,
    MessageHandler<State5, State6, Exclude<Error1 | Error2 | Error3 | Error4 | Error5, never>>,
    MessageHandler<State6, State7, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6, never>>,
    MessageHandler<State7, State8, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7, never>>,
    MessageHandler<State8, State9, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8, never>>
]): MessageHandler<State1, State9, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8, never>>;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6, Error6, State7, Error7, State8, Error8, State9, Error9, State10>(handlers: [
    MessageHandler<State1, State2, Exclude<Error1, never>>,
    MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>,
    MessageHandler<State3, State4, Exclude<Error1 | Error2 | Error3, never>>,
    MessageHandler<State4, State5, Exclude<Error1 | Error2 | Error3 | Error4, never>>,
    MessageHandler<State5, State6, Exclude<Error1 | Error2 | Error3 | Error4 | Error5, never>>,
    MessageHandler<State6, State7, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6, never>>,
    MessageHandler<State7, State8, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7, never>>,
    MessageHandler<State8, State9, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8, never>>,
    MessageHandler<State9, State10, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9, never>>
]): MessageHandler<State1, State10, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9, never>>;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6, Error6, State7, Error7, State8, Error8, State9, Error9, State10, Error10, State11>(handlers: [
    MessageHandler<State1, State2, Exclude<Error1, never>>,
    MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>,
    MessageHandler<State3, State4, Exclude<Error1 | Error2 | Error3, never>>,
    MessageHandler<State4, State5, Exclude<Error1 | Error2 | Error3 | Error4, never>>,
    MessageHandler<State5, State6, Exclude<Error1 | Error2 | Error3 | Error4 | Error5, never>>,
    MessageHandler<State6, State7, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6, never>>,
    MessageHandler<State7, State8, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7, never>>,
    MessageHandler<State8, State9, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8, never>>,
    MessageHandler<State9, State10, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9, never>>,
    MessageHandler<State10, State11, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9 | Error10, never>>
]): MessageHandler<State1, State11, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9 | Error10, never>>;
export declare function fallthroughMessageHandler<ExistingState, NewState, Error, Next>(handlers: ReadonlyArray<MessageHandler<ExistingState, NewState, Error | Next>>, isNext: (error: Readonly<Error | Next>) => error is Next, noMatch: () => Error): MessageHandler<ExistingState, NewState, Error>;
