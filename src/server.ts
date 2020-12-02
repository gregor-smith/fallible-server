import type { RequestListener, ServerResponse  } from 'http'

import WebSocket, { Server as WebSocketServer } from 'ws'
import { Result, Awaitable, asyncFallible, ok, error } from 'fallible'

import type {
    Cleanup,
    ErrorHandler,
    MessageHandler,
    Response,
    ResponseHandler
} from './types'
import { CloseWebSocket, cookieHeader } from './utils'


export function defaultErrorHandler() {
    return {
        status: 500,
        body: 'Internal server error'
    }
}


export function defaultResponseHandler() {
    return ok({
        status: 200,
        body: ''
    })
}


function setHeaders(response: ServerResponse, { cookies, headers }: Response) {
    if (cookies !== undefined) {
        for (const [ name, cookie ] of Object.entries(cookies)) {
            const header = cookieHeader(name, cookie)
            response.setHeader('Set-Cookie', header)
        }
    }
    if (headers !== undefined) {
        for (const [ key, value ] of Object.entries(headers)) {
            response.setHeader(key, String(value))
        }
    }
}


export type CreateRequestListenerArguments<State, Errors> = {
    messageHandler: MessageHandler<{}, State, Errors>
    responseHandler?: ResponseHandler<State, Errors>
    errorHandler?: ErrorHandler<Errors>
}


export type AwaitableRequestListener = (..._: Parameters<RequestListener>) => Promise<ReturnType<RequestListener>>


export function createRequestListener<State, Errors>({
    messageHandler,
    responseHandler = defaultResponseHandler,
    errorHandler = defaultErrorHandler
}: CreateRequestListenerArguments<State, Errors>): AwaitableRequestListener {
    return async (req, res) => {
        let response: Readonly<Response>
        try {
            const result = await asyncFallible<Response, Errors>(async propagate => {
                const { state, cleanup } = propagate(await messageHandler(req, {}))
                const response = await responseHandler(state)
                if (cleanup !== undefined) {
                    propagate(await cleanup())
                }
                return response
            })
            response = result.ok
                ? result.value
                : await errorHandler(result.value)
        }
        catch (exception: unknown) {
            response = defaultErrorHandler()
        }

        res.statusCode = response.status ?? 200

        if (typeof response.body === 'string') {
            setHeaders(res, response)
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', Buffer.byteLength(response.body))
            }
            res.end(response.body)
        }
        else if (response.body instanceof Buffer) {
            setHeaders(res, response)
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/octet-stream')
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', response.body.length)
            }
            res.end(response.body)
        }
        else if (response.body !== undefined) {
            // stream
            if ('pipe' in response.body) {
                setHeaders(res, response)
                if (!res.hasHeader('Content-Type')) {
                    res.setHeader('Content-Type', 'application/octet-stream')
                }
                response.body.pipe(res)
            }
            // websocket
            else {
                const wss = new WebSocketServer({ noServer: true })
                wss.on('headers', headers => {
                    if (response.cookies !== undefined) {
                        for (const [ name, cookie ] of Object.entries(response.cookies)) {
                            const header = cookieHeader(name, cookie)
                            headers.push(`Set-Cookie: ${header}`)
                        }
                    }
                    if (response.headers !== undefined) {
                        for (const [ key, value ] of Object.entries(response.headers)) {
                            headers.push(`${key}: ${value}`)
                        }
                    }
                })
                const socket = await new Promise<WebSocket>(resolve =>
                    wss.handleUpgrade(
                        req,
                        req.socket,
                        Buffer.alloc(0),
                        resolve
                    )
                )

                const { onOpen, onClose, onError, onMessage, onSendError } = response.body

                if (onOpen !== undefined) {
                    socket.on('open', onOpen)
                }
                if (onClose !== undefined) {
                    socket.on('close', onClose)
                }
                if (onError !== undefined) {
                    socket.on('error', onError)
                }

                socket.on('message', async data => {
                    const generator = onMessage(data)
                    while (true) {
                        const result = await generator.next()
                        if (result.done) {
                            if (result.value === CloseWebSocket) {
                                socket.close(1000)
                            }
                            return
                        }
                        const error = await new Promise<Error | undefined>(resolve =>
                            socket.send(result.value, resolve)
                        )
                        if (error !== undefined) {
                            await onSendError?.(error)
                        }
                    }
                })
            }
        }
        // no body
        else {
            setHeaders(res, response)
            res.end()
        }
    }
}


async function composeCleanups<Errors>(
    cleanups: ReadonlyArray<Cleanup<Errors>>,
    composeErrors: (errors: ReadonlyArray<Readonly<Errors>>) => Awaitable<Errors>
): Promise<Result<void, Errors>> {
    const errors: Errors[] = []
    for (let index = cleanups.length - 1; index >= 0; index--) {
        const result = await cleanups[index]()
        if (!result.ok) {
            errors.push(result.value)
        }
    }
    if (errors.length !== 0) {
        const composed = await composeErrors(errors)
        return error(composed)
    }
    return ok()
}


// there's probably some way to do this with variadic tuple types but fuck it
// see generateTypings.py in the root of the project
export function composeMessageHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
>(
    handlers: [
        MessageHandler<ExistingState, NewState1, Errors1>,
        MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2>>
    ) => Awaitable<Errors1 | Errors2>
): MessageHandler<
    ExistingState,
    NewState1 & NewState2,
    Errors1 | Errors2
>
export function composeMessageHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
    NewState3, Errors3,
>(
    handlers: [
        MessageHandler<ExistingState, NewState1, Errors1>,
        MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
        MessageHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3>>
    ) => Awaitable<Errors1 | Errors2 | Errors3>
): MessageHandler<
    ExistingState,
    NewState1 & NewState2 & NewState3,
    Errors1 | Errors2 | Errors3
>
export function composeMessageHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
    NewState3, Errors3,
    NewState4, Errors4,
>(
    handlers: [
        MessageHandler<ExistingState, NewState1, Errors1>,
        MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
        MessageHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4>>
    ) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4>
): MessageHandler<
    ExistingState,
    NewState1 & NewState2 & NewState3 & NewState4,
    Errors1 | Errors2 | Errors3 | Errors4
>
export function composeMessageHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
    NewState3, Errors3,
    NewState4, Errors4,
    NewState5, Errors5,
>(
    handlers: [
        MessageHandler<ExistingState, NewState1, Errors1>,
        MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
        MessageHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5>>
    ) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5>
): MessageHandler<
    ExistingState,
    NewState1 & NewState2 & NewState3 & NewState4 & NewState5,
    Errors1 | Errors2 | Errors3 | Errors4 | Errors5
>
export function composeMessageHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
    NewState3, Errors3,
    NewState4, Errors4,
    NewState5, Errors5,
    NewState6, Errors6,
>(
    handlers: [
        MessageHandler<ExistingState, NewState1, Errors1>,
        MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
        MessageHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>>
    ) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>
): MessageHandler<
    ExistingState,
    NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6,
    Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6
>
export function composeMessageHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
    NewState3, Errors3,
    NewState4, Errors4,
    NewState5, Errors5,
    NewState6, Errors6,
    NewState7, Errors7,
>(
    handlers: [
        MessageHandler<ExistingState, NewState1, Errors1>,
        MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
        MessageHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>>
    ) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>
): MessageHandler<
    ExistingState,
    NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7,
    Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7
>
export function composeMessageHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
    NewState3, Errors3,
    NewState4, Errors4,
    NewState5, Errors5,
    NewState6, Errors6,
    NewState7, Errors7,
    NewState8, Errors8,
>(
    handlers: [
        MessageHandler<ExistingState, NewState1, Errors1>,
        MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
        MessageHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7, NewState8, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>>
    ) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>
): MessageHandler<
    ExistingState,
    NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8,
    Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8
>
export function composeMessageHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
    NewState3, Errors3,
    NewState4, Errors4,
    NewState5, Errors5,
    NewState6, Errors6,
    NewState7, Errors7,
    NewState8, Errors8,
    NewState9, Errors9,
>(
    handlers: [
        MessageHandler<ExistingState, NewState1, Errors1>,
        MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
        MessageHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7, NewState8, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8, NewState9, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>>
    ) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>
): MessageHandler<
    ExistingState,
    NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8 & NewState9,
    Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9
>
export function composeMessageHandlers<
    ExistingState,
    NewState1, Errors1,
    NewState2, Errors2,
    NewState3, Errors3,
    NewState4, Errors4,
    NewState5, Errors5,
    NewState6, Errors6,
    NewState7, Errors7,
    NewState8, Errors8,
    NewState9, Errors9,
    NewState10, Errors10,
>(
    handlers: [
        MessageHandler<ExistingState, NewState1, Errors1>,
        MessageHandler<ExistingState & NewState1, NewState2, Errors1 | Errors2>,
        MessageHandler<ExistingState & NewState1 & NewState2, NewState3, Errors1 | Errors2 | Errors3>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3, NewState4, Errors1 | Errors2 | Errors3 | Errors4>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4, NewState5, Errors1 | Errors2 | Errors3 | Errors4 | Errors5>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5, NewState6, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6, NewState7, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7, NewState8, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8, NewState9, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9>,
        MessageHandler<ExistingState & NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8 & NewState9, NewState10, Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9 | Errors10>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9 | Errors10>>
    ) => Awaitable<Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9 | Errors10>
): MessageHandler<
    ExistingState,
    NewState1 & NewState2 & NewState3 & NewState4 & NewState5 & NewState6 & NewState7 & NewState8 & NewState9 & NewState10,
    Errors1 | Errors2 | Errors3 | Errors4 | Errors5 | Errors6 | Errors7 | Errors8 | Errors9 | Errors10
>
export function composeMessageHandlers<ExistingState, Errors>(
    handlers: ReadonlyArray<MessageHandler<any, any, Errors>>,
    composeCleanupErrors: (errors: ReadonlyArray<Readonly<Errors>>) => Awaitable<Errors>
): MessageHandler<ExistingState, any, Errors> {
    return async (message, state) => {
        const cleanups: Cleanup<Errors>[] = []

        for (const handler of handlers) {
            const result = await handler(message, state)
            if (!result.ok) {
                return asyncFallible(async propagate => {
                    propagate(await composeCleanups(cleanups, composeCleanupErrors))
                    return result
                })
            }
            state = result.value.state
            if (result.value.cleanup !== undefined) {
                cleanups.push(result.value.cleanup)
            }
        }

        return ok({
            state,
            cleanup: cleanups.length === 0
                ? undefined
                : () => composeCleanups(cleanups, composeCleanupErrors)
        })
    }
}
