/// <reference types="node" />
import type { RequestListener } from 'http';
import { Awaitable } from 'fallible';
import type { ErrorHandler, MessageHandler, ResponseHandler } from '../types';
export declare function defaultErrorHandler(): {
    status: number;
    body: string;
};
export declare function defaultResponseHandler(): import("fallible").Ok<{
    status: number;
    body: string;
}>;
export declare type CreateRequestListenerArguments<State, Errors> = {
    messageHandler: MessageHandler<{}, State, Errors>;
    responseHandler?: ResponseHandler<State, Errors>;
    errorHandler?: ErrorHandler<Errors>;
};
export declare type AwaitableRequestListener = (..._: Parameters<RequestListener>) => Promise<ReturnType<RequestListener>>;
export declare function createRequestListener<State, Errors>({ messageHandler, responseHandler, errorHandler }: CreateRequestListenerArguments<State, Errors>): AwaitableRequestListener;
export declare function composeMessageHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2>(handlers: [
    MessageHandler<ExistingState, NewState1, Errors1>,
    MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2>>) => Awaitable<Errors1 | Errors2>): MessageHandler<ExistingState, NewState1 & NewState2, Errors1 | Errors2>;
export declare function composeMessageHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2, NewState3, Errors3>(handlers: [
    MessageHandler<ExistingState, NewState1, Errors1>,
    MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    MessageHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3>>) => Awaitable<Errors1 | Errors2 | Errors3>): MessageHandler<ExistingState, NewState1 & NewState2 & NewState3, Errors1 | Errors2 | Errors3>;
export declare function composeMessageHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2, NewState3, Errors3, NewState4, Errors4>(handlers: [
    MessageHandler<ExistingState, NewState1, Errors1>,
    MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    MessageHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4>>) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4>): MessageHandler<ExistingState, NewState1 & NewState2 & NewState3 & NewState4, Errors1 | Errors2 | Errors3 | Errors4>;
export declare function composeMessageHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2, NewState3, Errors3, NewState4, Errors4, NewState5, Errors5>(handlers: [
    MessageHandler<ExistingState, NewState1, Errors1>,
    MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    MessageHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5>>) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5>): MessageHandler<ExistingState, NewState1 & NewState2 & NewState3 & NewState4 & NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>;
export declare function composeMessageHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2, NewState3, Errors3, NewState4, Errors4, NewState5, Errors5, NewState6, Errors6>(handlers: [
    MessageHandler<ExistingState, NewState1, Errors1>,
    MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    MessageHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>>) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>): MessageHandler<ExistingState, NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>;
export declare function composeMessageHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2, NewState3, Errors3, NewState4, Errors4, NewState5, Errors5, NewState6, Errors6, NewState7, Errors7>(handlers: [
    MessageHandler<ExistingState, NewState1, Errors1>,
    MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    MessageHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>>) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>): MessageHandler<ExistingState, NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>;
export declare function composeMessageHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2, NewState3, Errors3, NewState4, Errors4, NewState5, Errors5, NewState6, Errors6, NewState7, Errors7, NewState8, Errors8>(handlers: [
    MessageHandler<ExistingState, NewState1, Errors1>,
    MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    MessageHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7, NewState8, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>>) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>): MessageHandler<ExistingState, NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>;
export declare function composeMessageHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2, NewState3, Errors3, NewState4, Errors4, NewState5, Errors5, NewState6, Errors6, NewState7, Errors7, NewState8, Errors8, NewState9, Errors9>(handlers: [
    MessageHandler<ExistingState, NewState1, Errors1>,
    MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    MessageHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7, NewState8, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8, NewState9, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>>) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>): MessageHandler<ExistingState, NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8 & NewState9, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>;
export declare function composeMessageHandlers<ExistingState, NewState1, Errors1, NewState2, Errors2, NewState3, Errors3, NewState4, Errors4, NewState5, Errors5, NewState6, Errors6, NewState7, Errors7, NewState8, Errors8, NewState9, Errors9, NewState10, Errors10>(handlers: [
    MessageHandler<ExistingState, NewState1, Errors1>,
    MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    MessageHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7, NewState8, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8, NewState9, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>,
    MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8 & NewState9, NewState10, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9 | Errors10>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9 | Errors10>>) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9 | Errors10>): MessageHandler<ExistingState, NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8 & NewState9 & NewState10, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9 | Errors10>;
