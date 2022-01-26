import Websocket from 'ws';
import { Result } from 'fallible';
import type { AwaitableRequestListener, ExceptionListener, MessageHandler, RequestListenerCleanup, Response } from './types.js';
export declare function defaultOnWebsocketSendError(_: Websocket.Data, { name, message }: Error): void;
export declare type CreateRequestListenerArguments = {
    messageHandler: MessageHandler<void, Response>;
    exceptionListener?: ExceptionListener;
};
export declare function createRequestListener({ messageHandler, exceptionListener }: CreateRequestListenerArguments): [AwaitableRequestListener, RequestListenerCleanup];
export declare function composeMessageHandlers<State1, State2, State3>(handlers: [
    MessageHandler<State1, State2>,
    MessageHandler<State2, State3>
]): MessageHandler<State1, State3>;
export declare function composeMessageHandlers<State1, State2, State3, State4>(handlers: [
    MessageHandler<State1, State2>,
    MessageHandler<State2, State3>,
    MessageHandler<State3, State4>
]): MessageHandler<State1, State4>;
export declare function composeMessageHandlers<State1, State2, State3, State4, State5>(handlers: [
    MessageHandler<State1, State2>,
    MessageHandler<State2, State3>,
    MessageHandler<State3, State4>,
    MessageHandler<State4, State5>
]): MessageHandler<State1, State5>;
export declare function composeMessageHandlers<State1, State2, State3, State4, State5, State6>(handlers: [
    MessageHandler<State1, State2>,
    MessageHandler<State2, State3>,
    MessageHandler<State3, State4>,
    MessageHandler<State4, State5>,
    MessageHandler<State5, State6>
]): MessageHandler<State1, State6>;
export declare function composeMessageHandlers<State1, State2, State3, State4, State5, State6, State7>(handlers: [
    MessageHandler<State1, State2>,
    MessageHandler<State2, State3>,
    MessageHandler<State3, State4>,
    MessageHandler<State4, State5>,
    MessageHandler<State5, State6>,
    MessageHandler<State6, State7>
]): MessageHandler<State1, State7>;
export declare function composeMessageHandlers<State1, State2, State3, State4, State5, State6, State7, State8>(handlers: [
    MessageHandler<State1, State2>,
    MessageHandler<State2, State3>,
    MessageHandler<State3, State4>,
    MessageHandler<State4, State5>,
    MessageHandler<State5, State6>,
    MessageHandler<State6, State7>,
    MessageHandler<State7, State8>
]): MessageHandler<State1, State8>;
export declare function composeMessageHandlers<State1, State2, State3, State4, State5, State6, State7, State8, State9>(handlers: [
    MessageHandler<State1, State2>,
    MessageHandler<State2, State3>,
    MessageHandler<State3, State4>,
    MessageHandler<State4, State5>,
    MessageHandler<State5, State6>,
    MessageHandler<State6, State7>,
    MessageHandler<State7, State8>,
    MessageHandler<State8, State9>
]): MessageHandler<State1, State9>;
export declare function composeMessageHandlers<State1, State2, State3, State4, State5, State6, State7, State8, State9, State10>(handlers: [
    MessageHandler<State1, State2>,
    MessageHandler<State2, State3>,
    MessageHandler<State3, State4>,
    MessageHandler<State4, State5>,
    MessageHandler<State5, State6>,
    MessageHandler<State6, State7>,
    MessageHandler<State7, State8>,
    MessageHandler<State8, State9>,
    MessageHandler<State9, State10>
]): MessageHandler<State1, State10>;
export declare function composeMessageHandlers<State1, State2, State3, State4, State5, State6, State7, State8, State9, State10, State11>(handlers: [
    MessageHandler<State1, State2>,
    MessageHandler<State2, State3>,
    MessageHandler<State3, State4>,
    MessageHandler<State4, State5>,
    MessageHandler<State5, State6>,
    MessageHandler<State6, State7>,
    MessageHandler<State7, State8>,
    MessageHandler<State8, State9>,
    MessageHandler<State9, State10>,
    MessageHandler<State10, State11>
]): MessageHandler<State1, State11>;
export declare function composeResultMessageHandlers<State1, Error1, State2, Error2, State3>(handlers: [
    MessageHandler<State1, Result<State2, Error1>>,
    MessageHandler<State2, Result<State3, Error1 | Error2>>
]): MessageHandler<State1, Result<State3, Error1 | Error2>>;
export declare function composeResultMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4>(handlers: [
    MessageHandler<State1, Result<State2, Error1>>,
    MessageHandler<State2, Result<State3, Error1 | Error2>>,
    MessageHandler<State3, Result<State4, Error1 | Error2 | Error3>>
]): MessageHandler<State1, Result<State4, Error1 | Error2 | Error3>>;
export declare function composeResultMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5>(handlers: [
    MessageHandler<State1, Result<State2, Error1>>,
    MessageHandler<State2, Result<State3, Error1 | Error2>>,
    MessageHandler<State3, Result<State4, Error1 | Error2 | Error3>>,
    MessageHandler<State4, Result<State5, Error1 | Error2 | Error3 | Error4>>
]): MessageHandler<State1, Result<State5, Error1 | Error2 | Error3 | Error4>>;
export declare function composeResultMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6>(handlers: [
    MessageHandler<State1, Result<State2, Error1>>,
    MessageHandler<State2, Result<State3, Error1 | Error2>>,
    MessageHandler<State3, Result<State4, Error1 | Error2 | Error3>>,
    MessageHandler<State4, Result<State5, Error1 | Error2 | Error3 | Error4>>,
    MessageHandler<State5, Result<State6, Error1 | Error2 | Error3 | Error4 | Error5>>
]): MessageHandler<State1, Result<State6, Error1 | Error2 | Error3 | Error4 | Error5>>;
export declare function composeResultMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6, Error6, State7>(handlers: [
    MessageHandler<State1, Result<State2, Error1>>,
    MessageHandler<State2, Result<State3, Error1 | Error2>>,
    MessageHandler<State3, Result<State4, Error1 | Error2 | Error3>>,
    MessageHandler<State4, Result<State5, Error1 | Error2 | Error3 | Error4>>,
    MessageHandler<State5, Result<State6, Error1 | Error2 | Error3 | Error4 | Error5>>,
    MessageHandler<State6, Result<State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>>
]): MessageHandler<State1, Result<State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>>;
export declare function composeResultMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6, Error6, State7, Error7, State8>(handlers: [
    MessageHandler<State1, Result<State2, Error1>>,
    MessageHandler<State2, Result<State3, Error1 | Error2>>,
    MessageHandler<State3, Result<State4, Error1 | Error2 | Error3>>,
    MessageHandler<State4, Result<State5, Error1 | Error2 | Error3 | Error4>>,
    MessageHandler<State5, Result<State6, Error1 | Error2 | Error3 | Error4 | Error5>>,
    MessageHandler<State6, Result<State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>>,
    MessageHandler<State7, Result<State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>>
]): MessageHandler<State1, Result<State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>>;
export declare function composeResultMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6, Error6, State7, Error7, State8, Error8, State9>(handlers: [
    MessageHandler<State1, Result<State2, Error1>>,
    MessageHandler<State2, Result<State3, Error1 | Error2>>,
    MessageHandler<State3, Result<State4, Error1 | Error2 | Error3>>,
    MessageHandler<State4, Result<State5, Error1 | Error2 | Error3 | Error4>>,
    MessageHandler<State5, Result<State6, Error1 | Error2 | Error3 | Error4 | Error5>>,
    MessageHandler<State6, Result<State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>>,
    MessageHandler<State7, Result<State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>>,
    MessageHandler<State8, Result<State9, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>>
]): MessageHandler<State1, Result<State9, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>>;
export declare function composeResultMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6, Error6, State7, Error7, State8, Error8, State9, Error9, State10>(handlers: [
    MessageHandler<State1, Result<State2, Error1>>,
    MessageHandler<State2, Result<State3, Error1 | Error2>>,
    MessageHandler<State3, Result<State4, Error1 | Error2 | Error3>>,
    MessageHandler<State4, Result<State5, Error1 | Error2 | Error3 | Error4>>,
    MessageHandler<State5, Result<State6, Error1 | Error2 | Error3 | Error4 | Error5>>,
    MessageHandler<State6, Result<State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>>,
    MessageHandler<State7, Result<State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>>,
    MessageHandler<State8, Result<State9, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>>,
    MessageHandler<State9, Result<State10, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9>>
]): MessageHandler<State1, Result<State10, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9>>;
export declare function composeResultMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6, Error6, State7, Error7, State8, Error8, State9, Error9, State10, Error10, State11>(handlers: [
    MessageHandler<State1, Result<State2, Error1>>,
    MessageHandler<State2, Result<State3, Error1 | Error2>>,
    MessageHandler<State3, Result<State4, Error1 | Error2 | Error3>>,
    MessageHandler<State4, Result<State5, Error1 | Error2 | Error3 | Error4>>,
    MessageHandler<State5, Result<State6, Error1 | Error2 | Error3 | Error4 | Error5>>,
    MessageHandler<State6, Result<State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>>,
    MessageHandler<State7, Result<State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>>,
    MessageHandler<State8, Result<State9, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>>,
    MessageHandler<State9, Result<State10, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9>>,
    MessageHandler<State10, Result<State11, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9 | Error10>>
]): MessageHandler<State1, Result<State11, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9 | Error10>>;
export declare function fallthroughMessageHandler<ExistingState, NewState, Next>(handlers: ReadonlyArray<MessageHandler<ExistingState, NewState | Next>>, isNext: (state: Readonly<NewState | Next>) => state is Next, noMatch: NewState): MessageHandler<ExistingState, NewState>;
