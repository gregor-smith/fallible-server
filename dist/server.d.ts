import type { Result } from 'fallible';
import type { AwaitableRequestListener, ExceptionListener, MessageHandler, SocketMap } from './types.js';
export declare function createRequestListener(messageHandler: MessageHandler, exceptionListener?: ExceptionListener): [AwaitableRequestListener, SocketMap];
export declare function fallthroughMessageHandler<ExistingState, NewState, Next>(handlers: ReadonlyArray<MessageHandler<ExistingState, NewState | Next>>, isNext: (state: Readonly<NewState | Next>) => state is Next, noMatch: NewState): MessageHandler<ExistingState, NewState>;
export declare function composeMessageHandlers<StateA, StateB, StateC>(a: MessageHandler<StateA, StateB>, b: MessageHandler<StateB, StateC>): MessageHandler<StateA, StateC>;
export declare function composeResultMessageHandlers<StateA, StateB, StateC, ErrorA, ErrorB>(a: MessageHandler<StateA, Result<StateB, ErrorA>>, b: MessageHandler<StateB, Result<StateC, ErrorA | ErrorB>>): MessageHandler<StateA, Result<StateC, ErrorA | ErrorB>>;
