import type { ServerResponse } from 'http'

import Websocket from 'ws'
import { Awaitable, error, ok, Result } from 'fallible'

import type {
    AwaitableRequestListener,
    Cleanup,
    ErrorHandler,
    ExceptionHandler,
    MessageHandler,
    MessageHandlerResult,
    Pipeable,
    Response,
    WebsocketGenerator
} from './types.js'
import { CloseWebSocket, cookieHeader } from './general-utils.js'


export function defaultErrorHandler(): Response {
    return {
        status: 500,
        body: 'Internal server error'
    }
}


export function defaultOnWebsocketSendError(_: Websocket.Data, { name, message }: Error): Awaitable<void> {
    console.warn(`Unknown error sending Websocket message. Consider adding an 'onSendError' callback to your response. Name: '${name}'. Message: '${message}'`)
}



function * iterateHeaders({ cookies, headers }: Response): Iterable<[ string, string | string[] ]> {
    if (headers !== undefined) {
        for (const [ name, value ] of Object.entries(headers)) {
            yield typeof value === 'object'
                ? [ name, value.map(String) ]
                : [ name, String(value) ]
        }
    }
    if (cookies !== undefined) {
        const values = Object.entries(cookies)
            .map(([ name, cookie ]) => cookieHeader(name, cookie))
        yield [ 'Set-Cookie', values ]
    }
}


function setResponseHeaders(res: ServerResponse, response: Response): void {
    for (const [ name, values ] of iterateHeaders(response)) {
        res.setHeader(name, values)
    }
}


async function sendWebsocketMessages(
    websocket: Websocket,
    messages: WebsocketGenerator,
    onError = defaultOnWebsocketSendError
): Promise<void> {
    while (websocket.readyState === websocket.OPEN) {
        const result = await messages.next()
        if (result.done) {
            if (result.value === CloseWebSocket) {
                websocket.close(1000)  // regular close status
            }
            return
        }

        const error = await new Promise<Error | undefined>(resolve =>
            websocket.send(result.value, resolve)
        )
        // the only time an error *should* occur is if the readyState changes
        // in between the message being fetched and it being sent, which is
        // definitely possible since these are both async operations.
        // the underlying socket should not throw or return an error from the
        // the send callback because the websocket listens for the socket's
        // error event, which when fired results in the websocket being closed.
        // see:
        // https://github.com/websockets/ws/blob/d1a8af4ddb1b24a4ee23acf66decb0ed0e0d8862/lib/websocket.js#L923
        // https://github.com/websockets/ws/blob/d1a8af4ddb1b24a4ee23acf66decb0ed0e0d8862/lib/websocket.js#L856
        // that said, javascript is javascript, so on the safe assumption that
        // there is some kind of unlikely albeit possible edge case, we
        // pass any unknown errors to onError and then close the connection.
        if (error !== undefined) {
            if (websocket.readyState !== websocket.OPEN) {
                return
            }
            await onError(result.value, error)
            websocket.close(1011)  // server error close status
        }
    }
}


export type CreateRequestListenerArguments<Errors> = {
    messageHandler: MessageHandler<void, Response, Errors>
    errorHandler?: ErrorHandler<Errors>
    exceptionHandler?: ExceptionHandler
}


export function createRequestListener<Errors>({
    messageHandler,
    errorHandler,
    exceptionHandler
}: CreateRequestListenerArguments<Errors>): AwaitableRequestListener {
    if (errorHandler === undefined) {
        console.warn("Default error handler will be used. Consider overriding via 'errorHandler' option")
        errorHandler = defaultErrorHandler
    }
    if (exceptionHandler === undefined) {
        console.warn("Default exception handler will be used. Consider overriding via 'exceptionHandler' option")
        exceptionHandler = defaultErrorHandler
    }

    return async (req, res) => {
        let response: Readonly<Response>
        let cleanup: Cleanup | undefined
        try {
            const result = await messageHandler(req)
            if (result.ok) {
                response = result.value.state
                cleanup = result.value.cleanup
            }
            else {
                response = await errorHandler!(result.value)
            }
        }
        catch (exception: unknown) {
            response = await exceptionHandler!(exception)
        }

        res.statusCode = response.status ?? 200

        if (typeof response.body === 'string') {
            setResponseHeaders(res, response)
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', Buffer.byteLength(response.body))
            }
            await new Promise<void>(resolve =>
                res.end(response.body, resolve)
            )
        }
        else if (response.body instanceof Buffer) {
            setResponseHeaders(res, response)
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/octet-stream')
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', response.body.length)
            }
            await new Promise<void>(resolve =>
                res.end(response.body, resolve)
            )
        }
        // no body
        else if (response.body === undefined) {
            setResponseHeaders(res, response)
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', 0)
            }
            await new Promise<void>(resolve => res.end(resolve))
        }
        // stream
        else if ('pipe' in response.body) {
            setResponseHeaders(res, response)
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/octet-stream')
            }
            await new Promise<void>(resolve => {
                res.on('finish', resolve);
                (response.body as Pipeable).pipe(res)
            })
        }
        // websocket
        else {
            const server = new Websocket.Server({ noServer: true })
            server.on('headers', headers => {
                for (const [ name, values ] of iterateHeaders(response)) {
                    if (typeof values === 'string') {
                        headers.push(`${name}: ${values}`)
                    }
                    else {
                        for (const value of values) {
                            headers.push(`${name}: ${value}`)
                        }
                    }
                }
            })
            const websocket = await new Promise<Websocket>(resolve =>
                server.handleUpgrade(
                    req,
                    req.socket,
                    Buffer.alloc(0),
                    resolve
                )
            )

            const { onOpen, onClose, onMessage, onSendError } = response.body

            websocket.on('message', data =>
                sendWebsocketMessages(
                    websocket,
                    onMessage(data),
                    onSendError
                )
            )

            // no need to listen for the socket error event as close event is
            // always called on errors anyway. see:
            // https://github.com/websockets/ws/issues/1823#issuecomment-740056036

            let closeReason: [ number, string ]
            if (onOpen === undefined) {
                closeReason = await new Promise<[ number, string ]>(resolve =>
                    // can't just call onClose here in this callback because
                    // it's potentially async and as such needs to be awaited
                    // before the final cleanup is called
                    websocket.on('close', (...args) => resolve(args))
                )
            }
            else {
                [ closeReason, ] = await Promise.all([
                    new Promise<[ number, string ]>(resolve =>
                        websocket.on('close', (...args) => resolve(args))
                    ),
                    // the 'open' even is never fired when running in noServer
                    // mode, so just call onOpen straight away as the request
                    // is already opened
                    sendWebsocketMessages(
                        websocket,
                        onOpen(),
                        onSendError
                    )
                ])
            }

            if (onClose !== undefined) {
                await onClose(...closeReason)
            }

            // closing the WebSocketServer is not necessary because in noServer
            // mode all it does is terminate all connected sockets, which in
            // this case has already happened. see:
            // https://github.com/websockets/ws/blob/d1a8af4ddb1b24a4ee23acf66decb0ed0e0d8862/lib/websocket-server.js#L126
        }

        if (cleanup !== undefined) {
            await cleanup(response)
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
