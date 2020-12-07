import type { RequestListener, ServerResponse  } from 'http'

import WebSocket, { Server as WebSocketServer } from 'ws'
import { Result, Awaitable, asyncFallible, ok, error } from 'fallible'

import type {
    Cleanup,
    ErrorHandler,
    MessageHandler,
    Response,
    WebsocketResponse
} from './types'
import { CloseWebSocket, cookieHeader } from './utils'


export function defaultErrorHandler() {
    return {
        status: 500,
        body: 'Internal server error'
    }
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


export type CreateRequestListenerArguments<Errors> = {
    messageHandler: MessageHandler<void, Response, Errors>
    errorHandler?: ErrorHandler<Errors>
}


export type AwaitableRequestListener = (..._: Parameters<RequestListener>) => Promise<ReturnType<RequestListener>>


export function createRequestListener<Errors>({
    messageHandler,
    errorHandler = defaultErrorHandler
}: CreateRequestListenerArguments<Errors>): AwaitableRequestListener {
    return async (req, res) => {
        let response: Readonly<Response>
        try {
            const result = await asyncFallible<Response, Errors>(async propagate => {
                const { state, cleanup } = propagate(await messageHandler(req))
                if (cleanup !== undefined) {
                    propagate(await cleanup())
                }
                return ok(state)
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

                const sendMessages = async (generator: ReturnType<WebsocketResponse['onMessage']>) => {
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
                        if (error !== undefined && onSendError !== undefined) {
                            await onSendError(result.value, error)
                        }
                    }
                }

                if (onClose !== undefined) {
                    socket.on('close', onClose)
                }
                if (onError !== undefined) {
                    socket.on('error', onError)
                }

                socket.on('message', data => {
                    const generator = onMessage(data)
                    return sendMessages(generator)
                })

                // the 'open' even is never fired in this case, so just call
                // onOpen immediately
                if (onOpen !== undefined) {
                    const generator = onOpen()
                    await sendMessages(generator)
                }
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
    State1, Error1,
    State2
>(
    handlers: [
        MessageHandler<State1, State2, Error1>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Error1>>
    ) => Awaitable<Error1>
): MessageHandler<
    State1,
    State2,
    Error1
>
export function composeMessageHandlers<
    State1, Error1,
    State2, Error2,
    State3
>(
    handlers: [
        MessageHandler<State1, State2, Error1>,
        MessageHandler<State2, State3, Error1 | Error2>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Error1 | Error2>>
    ) => Awaitable<Error1 | Error2>
): MessageHandler<
    State1,
    State3,
    Error1 | Error2
>
export function composeMessageHandlers<
    State1, Error1,
    State2, Error2,
    State3, Error3,
    State4
>(
    handlers: [
        MessageHandler<State1, State2, Error1>,
        MessageHandler<State2, State3, Error1 | Error2>,
        MessageHandler<State3, State4, Error1 | Error2 | Error3>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Error1 | Error2 | Error3>>
    ) => Awaitable<Error1 | Error2 | Error3>
): MessageHandler<
    State1,
    State4,
    Error1 | Error2 | Error3
>
export function composeMessageHandlers<
    State1, Error1,
    State2, Error2,
    State3, Error3,
    State4, Error4,
    State5
>(
    handlers: [
        MessageHandler<State1, State2, Error1>,
        MessageHandler<State2, State3, Error1 | Error2>,
        MessageHandler<State3, State4, Error1 | Error2 | Error3>,
        MessageHandler<State4, State5, Error1 | Error2 | Error3 | Error4>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Error1 | Error2 | Error3 | Error4>>
    ) => Awaitable<Error1 | Error2 | Error3 | Error4>
): MessageHandler<
    State1,
    State5,
    Error1 | Error2 | Error3 | Error4
>
export function composeMessageHandlers<
    State1, Error1,
    State2, Error2,
    State3, Error3,
    State4, Error4,
    State5, Error5,
    State6
>(
    handlers: [
        MessageHandler<State1, State2, Error1>,
        MessageHandler<State2, State3, Error1 | Error2>,
        MessageHandler<State3, State4, Error1 | Error2 | Error3>,
        MessageHandler<State4, State5, Error1 | Error2 | Error3 | Error4>,
        MessageHandler<State5, State6, Error1 | Error2 | Error3 | Error4 | Error5>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Error1 | Error2 | Error3 | Error4 | Error5>>
    ) => Awaitable<Error1 | Error2 | Error3 | Error4 | Error5>
): MessageHandler<
    State1,
    State6,
    Error1 | Error2 | Error3 | Error4 | Error5
>
export function composeMessageHandlers<
    State1, Error1,
    State2, Error2,
    State3, Error3,
    State4, Error4,
    State5, Error5,
    State6, Error6,
    State7
>(
    handlers: [
        MessageHandler<State1, State2, Error1>,
        MessageHandler<State2, State3, Error1 | Error2>,
        MessageHandler<State3, State4, Error1 | Error2 | Error3>,
        MessageHandler<State4, State5, Error1 | Error2 | Error3 | Error4>,
        MessageHandler<State5, State6, Error1 | Error2 | Error3 | Error4 | Error5>,
        MessageHandler<State6, State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Error1 | Error2 | Error3 | Error4 | Error5 | Error6>>
    ) => Awaitable<Error1 | Error2 | Error3 | Error4 | Error5 | Error6>
): MessageHandler<
    State1,
    State7,
    Error1 | Error2 | Error3 | Error4 | Error5 | Error6
>
export function composeMessageHandlers<
    State1, Error1,
    State2, Error2,
    State3, Error3,
    State4, Error4,
    State5, Error5,
    State6, Error6,
    State7, Error7,
    State8
>(
    handlers: [
        MessageHandler<State1, State2, Error1>,
        MessageHandler<State2, State3, Error1 | Error2>,
        MessageHandler<State3, State4, Error1 | Error2 | Error3>,
        MessageHandler<State4, State5, Error1 | Error2 | Error3 | Error4>,
        MessageHandler<State5, State6, Error1 | Error2 | Error3 | Error4 | Error5>,
        MessageHandler<State6, State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>,
        MessageHandler<State7, State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>>
    ) => Awaitable<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>
): MessageHandler<
    State1,
    State8,
    Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7
>
export function composeMessageHandlers<
    State1, Error1,
    State2, Error2,
    State3, Error3,
    State4, Error4,
    State5, Error5,
    State6, Error6,
    State7, Error7,
    State8, Error8,
    State9
>(
    handlers: [
        MessageHandler<State1, State2, Error1>,
        MessageHandler<State2, State3, Error1 | Error2>,
        MessageHandler<State3, State4, Error1 | Error2 | Error3>,
        MessageHandler<State4, State5, Error1 | Error2 | Error3 | Error4>,
        MessageHandler<State5, State6, Error1 | Error2 | Error3 | Error4 | Error5>,
        MessageHandler<State6, State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>,
        MessageHandler<State7, State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>,
        MessageHandler<State8, State9, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>>
    ) => Awaitable<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>
): MessageHandler<
    State1,
    State9,
    Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8
>
export function composeMessageHandlers<
    State1, Error1,
    State2, Error2,
    State3, Error3,
    State4, Error4,
    State5, Error5,
    State6, Error6,
    State7, Error7,
    State8, Error8,
    State9, Error9,
    State10
>(
    handlers: [
        MessageHandler<State1, State2, Error1>,
        MessageHandler<State2, State3, Error1 | Error2>,
        MessageHandler<State3, State4, Error1 | Error2 | Error3>,
        MessageHandler<State4, State5, Error1 | Error2 | Error3 | Error4>,
        MessageHandler<State5, State6, Error1 | Error2 | Error3 | Error4 | Error5>,
        MessageHandler<State6, State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>,
        MessageHandler<State7, State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>,
        MessageHandler<State8, State9, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>,
        MessageHandler<State9, State10, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9>>
    ) => Awaitable<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9>
): MessageHandler<
    State1,
    State10,
    Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9
>
export function composeMessageHandlers<
    State1, Error1,
    State2, Error2,
    State3, Error3,
    State4, Error4,
    State5, Error5,
    State6, Error6,
    State7, Error7,
    State8, Error8,
    State9, Error9,
    State10, Error10,
    State11
>(
    handlers: [
        MessageHandler<State1, State2, Error1>,
        MessageHandler<State2, State3, Error1 | Error2>,
        MessageHandler<State3, State4, Error1 | Error2 | Error3>,
        MessageHandler<State4, State5, Error1 | Error2 | Error3 | Error4>,
        MessageHandler<State5, State6, Error1 | Error2 | Error3 | Error4 | Error5>,
        MessageHandler<State6, State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>,
        MessageHandler<State7, State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>,
        MessageHandler<State8, State9, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>,
        MessageHandler<State9, State10, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9>,
        MessageHandler<State10, State11, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9 | Error10>,
    ],
    composeCleanupErrors: (
        errors: ReadonlyArray<Readonly<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9 | Error10>>
    ) => Awaitable<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9 | Error10>
): MessageHandler<
    State1,
    State11,
    Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9 | Error10
>
export function composeMessageHandlers<State, Error>(
    handlers: ReadonlyArray<MessageHandler<any, any, Error>>,
    composeCleanupErrors: (errors: ReadonlyArray<Readonly<Error>>) => Awaitable<Error>
): MessageHandler<State, any, Error> {
    return async (message, state) => {
        const cleanups: Cleanup<Error>[] = []

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
