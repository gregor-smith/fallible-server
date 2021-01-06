import type { ServerResponse } from 'http'

import WebSocket, { Server as WebSocketServer } from 'ws'
import { error, ok, Result } from 'fallible'

import type {
    AwaitableRequestListener,
    Cleanup,
    ErrorHandler,
    MessageHandler,
    MessageHandlerResult,
    Response,
    WebsocketResponse
} from './types'
import { CloseWebSocket, cookieHeader } from './general-utils'


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


export function createRequestListener<Errors>({
    messageHandler,
    errorHandler = defaultErrorHandler
}: CreateRequestListenerArguments<Errors>): AwaitableRequestListener {
    return async (req, res) => {
        let response: Readonly<Response>
        try {
            const result = await messageHandler(req)
            if (result.ok) {
                response = result.value.state
                if (result.value.cleanup !== undefined) {
                    await result.value.cleanup(response)
                }
            }
            else {
                response = await errorHandler(result.value)
            }
        }
        catch {
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


function composedCleanups(cleanups: ReadonlyArray<Cleanup>): Cleanup {
    return async response => {
        for (let index = cleanups.length - 1; index >= 0; index--) {
            await cleanups[index]!(response)
        }
    }
}


// there's probably some way to do this with variadic tuple types but fuck it
// see generateTypings.py in the root of the project
export function composeMessageHandlers<
    State1, Error1,
    State2, Error2,
    State3
>(
    handlers: [
        MessageHandler<State1, State2, Exclude<Error1, never>>,
        MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>,
    ]
): MessageHandler<
    State1,
    State3,
    Exclude<Error1 | Error2, never>
>
export function composeMessageHandlers<
    State1, Error1,
    State2, Error2,
    State3, Error3,
    State4
>(
    handlers: [
        MessageHandler<State1, State2, Exclude<Error1, never>>,
        MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>,
        MessageHandler<State3, State4, Exclude<Error1 | Error2 | Error3, never>>,
    ]
): MessageHandler<
    State1,
    State4,
    Exclude<Error1 | Error2 | Error3, never>
>
export function composeMessageHandlers<
    State1, Error1,
    State2, Error2,
    State3, Error3,
    State4, Error4,
    State5
>(
    handlers: [
        MessageHandler<State1, State2, Exclude<Error1, never>>,
        MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>,
        MessageHandler<State3, State4, Exclude<Error1 | Error2 | Error3, never>>,
        MessageHandler<State4, State5, Exclude<Error1 | Error2 | Error3 | Error4, never>>,
    ]
): MessageHandler<
    State1,
    State5,
    Exclude<Error1 | Error2 | Error3 | Error4, never>
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
        MessageHandler<State1, State2, Exclude<Error1, never>>,
        MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>,
        MessageHandler<State3, State4, Exclude<Error1 | Error2 | Error3, never>>,
        MessageHandler<State4, State5, Exclude<Error1 | Error2 | Error3 | Error4, never>>,
        MessageHandler<State5, State6, Exclude<Error1 | Error2 | Error3 | Error4 | Error5, never>>,
    ]
): MessageHandler<
    State1,
    State6,
    Exclude<Error1 | Error2 | Error3 | Error4 | Error5, never>
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
        MessageHandler<State1, State2, Exclude<Error1, never>>,
        MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>,
        MessageHandler<State3, State4, Exclude<Error1 | Error2 | Error3, never>>,
        MessageHandler<State4, State5, Exclude<Error1 | Error2 | Error3 | Error4, never>>,
        MessageHandler<State5, State6, Exclude<Error1 | Error2 | Error3 | Error4 | Error5, never>>,
        MessageHandler<State6, State7, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6, never>>,
    ]
): MessageHandler<
    State1,
    State7,
    Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6, never>
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
        MessageHandler<State1, State2, Exclude<Error1, never>>,
        MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>,
        MessageHandler<State3, State4, Exclude<Error1 | Error2 | Error3, never>>,
        MessageHandler<State4, State5, Exclude<Error1 | Error2 | Error3 | Error4, never>>,
        MessageHandler<State5, State6, Exclude<Error1 | Error2 | Error3 | Error4 | Error5, never>>,
        MessageHandler<State6, State7, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6, never>>,
        MessageHandler<State7, State8, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7, never>>,
    ]
): MessageHandler<
    State1,
    State8,
    Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7, never>
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
        MessageHandler<State1, State2, Exclude<Error1, never>>,
        MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>,
        MessageHandler<State3, State4, Exclude<Error1 | Error2 | Error3, never>>,
        MessageHandler<State4, State5, Exclude<Error1 | Error2 | Error3 | Error4, never>>,
        MessageHandler<State5, State6, Exclude<Error1 | Error2 | Error3 | Error4 | Error5, never>>,
        MessageHandler<State6, State7, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6, never>>,
        MessageHandler<State7, State8, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7, never>>,
        MessageHandler<State8, State9, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8, never>>,
    ]
): MessageHandler<
    State1,
    State9,
    Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8, never>
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
        MessageHandler<State1, State2, Exclude<Error1, never>>,
        MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>,
        MessageHandler<State3, State4, Exclude<Error1 | Error2 | Error3, never>>,
        MessageHandler<State4, State5, Exclude<Error1 | Error2 | Error3 | Error4, never>>,
        MessageHandler<State5, State6, Exclude<Error1 | Error2 | Error3 | Error4 | Error5, never>>,
        MessageHandler<State6, State7, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6, never>>,
        MessageHandler<State7, State8, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7, never>>,
        MessageHandler<State8, State9, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8, never>>,
        MessageHandler<State9, State10, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9, never>>,
    ]
): MessageHandler<
    State1,
    State10,
    Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9, never>
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
        MessageHandler<State1, State2, Exclude<Error1, never>>,
        MessageHandler<State2, State3, Exclude<Error1 | Error2, never>>,
        MessageHandler<State3, State4, Exclude<Error1 | Error2 | Error3, never>>,
        MessageHandler<State4, State5, Exclude<Error1 | Error2 | Error3 | Error4, never>>,
        MessageHandler<State5, State6, Exclude<Error1 | Error2 | Error3 | Error4 | Error5, never>>,
        MessageHandler<State6, State7, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6, never>>,
        MessageHandler<State7, State8, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7, never>>,
        MessageHandler<State8, State9, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8, never>>,
        MessageHandler<State9, State10, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9, never>>,
        MessageHandler<State10, State11, Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9 | Error10, never>>,
    ]
): MessageHandler<
    State1,
    State11,
    Exclude<Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9 | Error10, never>
>
export function composeMessageHandlers<State, Error>(
    handlers: ReadonlyArray<MessageHandler<any, any, Error>>
): MessageHandler<State, any, Error> {
    return async (message, state) => {
        const cleanups: Cleanup[] = []

        for (const handler of handlers) {
            const result = await handler(message, state)
            if (!result.ok) {
                await composedCleanups(cleanups)()
                return result
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
                : composedCleanups(cleanups)
        })
    }
}


export function fallthroughMessageHandler<ExistingState, NewState, Error, Next>(
    handlers: ReadonlyArray<MessageHandler<ExistingState, NewState, Error | Next>>,
    isNext: (error: Readonly<Error | Next>) => error is Next,
    noMatch: () => Error
): MessageHandler<ExistingState, NewState, Error> {
    return async (message, state) => {
        for (const handler of handlers) {
            const result = await handler(message, state)
            if (result.ok || !isNext(result.value)) {
                return result as Result<MessageHandlerResult<NewState>, Error>
            }
        }
        return error(noMatch())
    }
}
