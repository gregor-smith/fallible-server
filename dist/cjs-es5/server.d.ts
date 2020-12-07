/// <reference types="node" />
import type { RequestListener } from 'http';
import { Awaitable } from 'fallible';
import type { ErrorHandler, MessageHandler, Response } from './types';
export declare function defaultErrorHandler(): {
    status: number;
    body: string;
};
export declare type CreateRequestListenerArguments<Errors> = {
    messageHandler: MessageHandler<void, Response, Errors>;
    errorHandler?: ErrorHandler<Errors>;
};
export declare type AwaitableRequestListener = (..._: Parameters<RequestListener>) => Promise<ReturnType<RequestListener>>;
export declare function createRequestListener<Errors>({ messageHandler, errorHandler }: CreateRequestListenerArguments<Errors>): AwaitableRequestListener;
export declare function composeMessageHandlers<State1, Error1, State2>(handlers: [
    MessageHandler<State1, State2, Error1>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Error1>>) => Awaitable<Error1>): MessageHandler<State1, State2, Error1>;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3>(handlers: [
    MessageHandler<State1, State2, Error1>,
    MessageHandler<State2, State3, Error1 | Error2>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Error1 | Error2>>) => Awaitable<Error1 | Error2>): MessageHandler<State1, State3, Error1 | Error2>;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4>(handlers: [
    MessageHandler<State1, State2, Error1>,
    MessageHandler<State2, State3, Error1 | Error2>,
    MessageHandler<State3, State4, Error1 | Error2 | Error3>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Error1 | Error2 | Error3>>) => Awaitable<Error1 | Error2 | Error3>): MessageHandler<State1, State4, Error1 | Error2 | Error3>;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5>(handlers: [
    MessageHandler<State1, State2, Error1>,
    MessageHandler<State2, State3, Error1 | Error2>,
    MessageHandler<State3, State4, Error1 | Error2 | Error3>,
    MessageHandler<State4, State5, Error1 | Error2 | Error3 | Error4>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Error1 | Error2 | Error3 | Error4>>) => Awaitable<Error1 | Error2 | Error3 | Error4>): MessageHandler<State1, State5, Error1 | Error2 | Error3 | Error4>;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6>(handlers: [
    MessageHandler<State1, State2, Error1>,
    MessageHandler<State2, State3, Error1 | Error2>,
    MessageHandler<State3, State4, Error1 | Error2 | Error3>,
    MessageHandler<State4, State5, Error1 | Error2 | Error3 | Error4>,
    MessageHandler<State5, State6, Error1 | Error2 | Error3 | Error4 | Error5>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Error1 | Error2 | Error3 | Error4 | Error5>>) => Awaitable<Error1 | Error2 | Error3 | Error4 | Error5>): MessageHandler<State1, State6, Error1 | Error2 | Error3 | Error4 | Error5>;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6, Error6, State7>(handlers: [
    MessageHandler<State1, State2, Error1>,
    MessageHandler<State2, State3, Error1 | Error2>,
    MessageHandler<State3, State4, Error1 | Error2 | Error3>,
    MessageHandler<State4, State5, Error1 | Error2 | Error3 | Error4>,
    MessageHandler<State5, State6, Error1 | Error2 | Error3 | Error4 | Error5>,
    MessageHandler<State6, State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Error1 | Error2 | Error3 | Error4 | Error5 | Error6>>) => Awaitable<Error1 | Error2 | Error3 | Error4 | Error5 | Error6>): MessageHandler<State1, State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6, Error6, State7, Error7, State8>(handlers: [
    MessageHandler<State1, State2, Error1>,
    MessageHandler<State2, State3, Error1 | Error2>,
    MessageHandler<State3, State4, Error1 | Error2 | Error3>,
    MessageHandler<State4, State5, Error1 | Error2 | Error3 | Error4>,
    MessageHandler<State5, State6, Error1 | Error2 | Error3 | Error4 | Error5>,
    MessageHandler<State6, State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>,
    MessageHandler<State7, State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>>) => Awaitable<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>): MessageHandler<State1, State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6, Error6, State7, Error7, State8, Error8, State9>(handlers: [
    MessageHandler<State1, State2, Error1>,
    MessageHandler<State2, State3, Error1 | Error2>,
    MessageHandler<State3, State4, Error1 | Error2 | Error3>,
    MessageHandler<State4, State5, Error1 | Error2 | Error3 | Error4>,
    MessageHandler<State5, State6, Error1 | Error2 | Error3 | Error4 | Error5>,
    MessageHandler<State6, State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>,
    MessageHandler<State7, State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>,
    MessageHandler<State8, State9, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>>) => Awaitable<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>): MessageHandler<State1, State9, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6, Error6, State7, Error7, State8, Error8, State9, Error9, State10>(handlers: [
    MessageHandler<State1, State2, Error1>,
    MessageHandler<State2, State3, Error1 | Error2>,
    MessageHandler<State3, State4, Error1 | Error2 | Error3>,
    MessageHandler<State4, State5, Error1 | Error2 | Error3 | Error4>,
    MessageHandler<State5, State6, Error1 | Error2 | Error3 | Error4 | Error5>,
    MessageHandler<State6, State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>,
    MessageHandler<State7, State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>,
    MessageHandler<State8, State9, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>,
    MessageHandler<State9, State10, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9>>) => Awaitable<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9>): MessageHandler<State1, State10, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9>;
export declare function composeMessageHandlers<State1, Error1, State2, Error2, State3, Error3, State4, Error4, State5, Error5, State6, Error6, State7, Error7, State8, Error8, State9, Error9, State10, Error10, State11>(handlers: [
    MessageHandler<State1, State2, Error1>,
    MessageHandler<State2, State3, Error1 | Error2>,
    MessageHandler<State3, State4, Error1 | Error2 | Error3>,
    MessageHandler<State4, State5, Error1 | Error2 | Error3 | Error4>,
    MessageHandler<State5, State6, Error1 | Error2 | Error3 | Error4 | Error5>,
    MessageHandler<State6, State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>,
    MessageHandler<State7, State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>,
    MessageHandler<State8, State9, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>,
    MessageHandler<State9, State10, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9>,
    MessageHandler<State10, State11, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9 | Error10>
], composeCleanupErrors: (errors: ReadonlyArray<Readonly<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9 | Error10>>) => Awaitable<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9 | Error10>): MessageHandler<State1, State11, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9 | Error10>;
