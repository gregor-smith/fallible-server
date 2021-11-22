import Websocket from 'ws';
import type { Awaitable } from 'fallible';
import type { AwaitableRequestListener, ExceptionListener, MessageHandler, Response } from './types.js';
export declare function defaultOnWebsocketSendError(_: Websocket.Data, { name, message }: Error): Awaitable<void>;
export declare type CreateRequestListenerArguments = {
    messageHandler: MessageHandler<void, Response>;
    exceptionListener?: ExceptionListener;
};
export declare function createRequestListener({ messageHandler, exceptionListener }: CreateRequestListenerArguments): AwaitableRequestListener;
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
export declare function fallthroughMessageHandler<ExistingState, NewState, Next>(handlers: ReadonlyArray<MessageHandler<ExistingState, NewState | Next>>, isNext: (state: Readonly<NewState | Next>) => state is Next, noMatch: NewState): MessageHandler<ExistingState, NewState>;
