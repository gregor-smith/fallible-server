import type { ServerResponse } from 'http'
import { pipeline } from 'stream/promises'

import WebSocket, { Data, Server as WebSocketServer } from 'ws'
import { ok, Result } from 'fallible'

import type {
    AwaitableRequestListener,
    Cleanup,
    ExceptionListener,
    MessageHandler,
    MessageHandlerResult,
    RequestListenerCleanup,
    Response,
    WebsocketBroadcaster,
    WebsocketIterator,
    WebsocketSendErrorCallback
} from './types.js'
import { iterateAsResolved, cookieHeader, response } from './general-utils.js'


function warn(message: string): void {
    console.warn(`fallible-server: ${message}`)
}


export function defaultOnWebsocketSendError(
    _data: Data,
    { name, message }: Error
): void {
    warn(`Unknown error sending Websocket message. Consider adding an 'onSendError' callback to your response. Name: '${name}'. Message: '${message}'`)
}


function setResponseHeaders(res: ServerResponse, { cookies, headers }: Response): void {
    if (headers !== undefined) {
        for (const [ name, value ] of Object.entries(headers)) {
            const header = Array.isArray(value) ? value.map(String) : String(value)
            res.setHeader(name, header)
        }
    }
    if (cookies !== undefined) {
        const values = Object.entries(cookies)
            .map(([ name, cookie ]) => cookieHeader(name, cookie))
        res.setHeader('Set-Cookie', values)
    }
}


function send(websocket: WebSocket, data: Data): Promise<Error | undefined> {
    return new Promise<Error | undefined>(resolve =>
        websocket.send(data, resolve)
    )
}


function * sendAll(
    server: WebSocketServer,
    data: Data,
    websocket?: WebSocket
): Generator<Promise<Error | undefined>, void, unknown> {
    for (const client of server.clients) {
        if (client.readyState !== WebSocket.OPEN || client === websocket) {
            continue
        }
        yield send(client, data)
    }
}


async function sendWebsocketMessages(
    server: WebSocketServer,
    websocket: WebSocket,
    messages: WebsocketIterator,
    onError: WebsocketSendErrorCallback = defaultOnWebsocketSendError
): Promise<void> {
    while (true) {
        const result = await messages.next()
        if (result.done) {
            if (result.value?.tag === 'Close') {
                websocket.close(1000)
            }
            return
        }
        switch (result.value.tag) {
            case 'Broadcast': {
                const promises = sendAll(
                    server,
                    result.value.data,
                    result.value.self ? websocket : undefined
                )
                for await (const error of iterateAsResolved(promises)) {
                    if (error === undefined) {
                        continue
                    }
                    await onError(result.value.data, error)
                }
                break
            }
            case 'Message': {
                const error = await send(websocket, result.value.data)
                if (error !== undefined) {
                    await onError(result.value.data, error)
                }
            }
        }
    }
}


export type CreateRequestListenerArguments = {
    messageHandler: MessageHandler<void, Response>
    exceptionListener?: ExceptionListener
}


function getDefaultExceptionListener(): ExceptionListener {
    warn("default exception listener will be used. Consider overriding via the 'exceptionListener' option")
    return console.error
}


export function createRequestListener({
    messageHandler,
    exceptionListener = getDefaultExceptionListener()
}: CreateRequestListenerArguments): [ AwaitableRequestListener, RequestListenerCleanup, WebsocketBroadcaster ] {
    const server = new WebSocketServer({ noServer: true })

    const listener: AwaitableRequestListener = async (req, res) => {
        let response: Readonly<Response>
        let cleanup: Cleanup | undefined
        try {
            const result = await messageHandler(req)
            response = result.state
            cleanup = result.cleanup
        }
        catch (exception: unknown) {
            exceptionListener(exception, req)
            try {
                if (req.aborted) {
                    if (cleanup !== undefined) {
                        await cleanup(req)
                    }
                }
                else {
                    res.statusCode = 500
                    res.setHeader('Content-Length', 0)
                    await Promise.all([
                        cleanup?.(req),
                        new Promise<void>(resolve => {
                            res.on('close', resolve)
                            res.end(resolve)
                        })
                    ])
                }
            }
            catch (exception: unknown) {
                exceptionListener(exception, req)
            }
            return
        }

        res.statusCode = response.status ?? 200

        if (typeof response.body === 'string') {
            setResponseHeaders(res, response)
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8')
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', Buffer.byteLength(response.body))
            }
            try {
                await new Promise<void>(resolve => {
                    res.on('close', resolve)
                    res.end(response.body, 'utf-8', resolve)
                })
            }
            catch (exception) {
                exceptionListener(exception, req, response)
            }
        }
        else if (response.body instanceof Buffer) {
            setResponseHeaders(res, response)
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/octet-stream')
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', response.body.length)
            }
            try {
                await new Promise<void>(resolve => {
                    res.on('close', resolve)
                    res.end(response.body, resolve)
                })
            }
            catch (exception) {
                exceptionListener(exception, req, response)
            }
        }
        // no body
        else if (response.body === undefined) {
            setResponseHeaders(res, response)
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', 0)
            }
            try {
                await new Promise<void>(resolve => {
                    res.on('close', resolve)
                    res.end(resolve)
                })
            }
            catch (exception) {
                exceptionListener(exception, req, response)
            }
        }
        // websocket
        else if ('onMessage' in response.body) {
            const websocket = await new Promise<WebSocket>(resolve =>
                server.handleUpgrade(
                    req,
                    req.socket,
                    Buffer.alloc(0),
                    resolve
                )
            )

            const { onOpen, onMessage, onSendError, onClose } = response.body

            websocket.on('message', data =>
                sendWebsocketMessages(
                    server,
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
                        server,
                        websocket,
                        onOpen(),
                        onSendError
                    )
                ])
            }

            if (onClose !== undefined) {
                await onClose(...closeReason)
            }
        }
        // pipeline source
        else {
            setResponseHeaders(res, response)
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/octet-stream')
            }
            try {
                await pipeline(response.body, res)
            }
            catch (exception) {
                if ((exception as NodeJS.ErrnoException)?.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
                    exceptionListener(exception, req, response)
                }
            }
        }

        if (cleanup !== undefined) {
            await cleanup(req, response)
        }
    }

    const cleanup: RequestListenerCleanup = () =>
        new Promise(resolve => server.close(resolve))

    const broadcaster: WebsocketBroadcaster = data => {
        const promises = sendAll(server, data)
        return iterateAsResolved(promises)
    }

    return [ listener, cleanup, broadcaster ]
}


// there's probably some way to do this with variadic tuple types but fuck it
// see generateTypings.py in the root of the project
export function composeMessageHandlers<
    State1,
    State2,
    State3
>(
    handlers: [
        MessageHandler<State1, State2>,
        MessageHandler<State2, State3>,
    ]
): MessageHandler<State1, State3>
export function composeMessageHandlers<
    State1,
    State2,
    State3,
    State4
>(
    handlers: [
        MessageHandler<State1, State2>,
        MessageHandler<State2, State3>,
        MessageHandler<State3, State4>,
    ]
): MessageHandler<State1, State4>
export function composeMessageHandlers<
    State1,
    State2,
    State3,
    State4,
    State5
>(
    handlers: [
        MessageHandler<State1, State2>,
        MessageHandler<State2, State3>,
        MessageHandler<State3, State4>,
        MessageHandler<State4, State5>,
    ]
): MessageHandler<State1, State5>
export function composeMessageHandlers<
    State1,
    State2,
    State3,
    State4,
    State5,
    State6
>(
    handlers: [
        MessageHandler<State1, State2>,
        MessageHandler<State2, State3>,
        MessageHandler<State3, State4>,
        MessageHandler<State4, State5>,
        MessageHandler<State5, State6>,
    ]
): MessageHandler<State1, State6>
export function composeMessageHandlers<
    State1,
    State2,
    State3,
    State4,
    State5,
    State6,
    State7
>(
    handlers: [
        MessageHandler<State1, State2>,
        MessageHandler<State2, State3>,
        MessageHandler<State3, State4>,
        MessageHandler<State4, State5>,
        MessageHandler<State5, State6>,
        MessageHandler<State6, State7>,
    ]
): MessageHandler<State1, State7>
export function composeMessageHandlers<
    State1,
    State2,
    State3,
    State4,
    State5,
    State6,
    State7,
    State8
>(
    handlers: [
        MessageHandler<State1, State2>,
        MessageHandler<State2, State3>,
        MessageHandler<State3, State4>,
        MessageHandler<State4, State5>,
        MessageHandler<State5, State6>,
        MessageHandler<State6, State7>,
        MessageHandler<State7, State8>,
    ]
): MessageHandler<State1, State8>
export function composeMessageHandlers<
    State1,
    State2,
    State3,
    State4,
    State5,
    State6,
    State7,
    State8,
    State9
>(
    handlers: [
        MessageHandler<State1, State2>,
        MessageHandler<State2, State3>,
        MessageHandler<State3, State4>,
        MessageHandler<State4, State5>,
        MessageHandler<State5, State6>,
        MessageHandler<State6, State7>,
        MessageHandler<State7, State8>,
        MessageHandler<State8, State9>,
    ]
): MessageHandler<State1, State9>
export function composeMessageHandlers<
    State1,
    State2,
    State3,
    State4,
    State5,
    State6,
    State7,
    State8,
    State9,
    State10
>(
    handlers: [
        MessageHandler<State1, State2>,
        MessageHandler<State2, State3>,
        MessageHandler<State3, State4>,
        MessageHandler<State4, State5>,
        MessageHandler<State5, State6>,
        MessageHandler<State6, State7>,
        MessageHandler<State7, State8>,
        MessageHandler<State8, State9>,
        MessageHandler<State9, State10>,
    ]
): MessageHandler<State1, State10>
export function composeMessageHandlers<
    State1,
    State2,
    State3,
    State4,
    State5,
    State6,
    State7,
    State8,
    State9,
    State10,
    State11
>(
    handlers: [
        MessageHandler<State1, State2>,
        MessageHandler<State2, State3>,
        MessageHandler<State3, State4>,
        MessageHandler<State4, State5>,
        MessageHandler<State5, State6>,
        MessageHandler<State6, State7>,
        MessageHandler<State7, State8>,
        MessageHandler<State8, State9>,
        MessageHandler<State9, State10>,
        MessageHandler<State10, State11>,
    ]
): MessageHandler<State1, State11>
export function composeMessageHandlers<State>(
    handlers: ReadonlyArray<MessageHandler<any, any>>
): MessageHandler<State, any> {
    return async (message, state) => {
        const cleanups: Cleanup[] = []
        for (const handler of handlers) {
            const result = await handler(message, state)
            if (result.cleanup !== undefined) {
                cleanups.push(result.cleanup)
            }
            state = result.state
        }
        return composeCleanupResponse(state, cleanups)
    }
}


export function composeResultMessageHandlers<
    State1, Error1,
    State2, Error2,
    State3
>(
    handlers: [
        MessageHandler<State1, Result<State2, Error1>>,
        MessageHandler<State2, Result<State3, Error1 | Error2>>,
    ]
): MessageHandler<State1, Result<State3, Error1 | Error2>>
export function composeResultMessageHandlers<
    State1, Error1,
    State2, Error2,
    State3, Error3,
    State4
>(
    handlers: [
        MessageHandler<State1, Result<State2, Error1>>,
        MessageHandler<State2, Result<State3, Error1 | Error2>>,
        MessageHandler<State3, Result<State4, Error1 | Error2 | Error3>>,
    ]
): MessageHandler<State1, Result<State4, Error1 | Error2 | Error3>>
export function composeResultMessageHandlers<
    State1, Error1,
    State2, Error2,
    State3, Error3,
    State4, Error4,
    State5
>(
    handlers: [
        MessageHandler<State1, Result<State2, Error1>>,
        MessageHandler<State2, Result<State3, Error1 | Error2>>,
        MessageHandler<State3, Result<State4, Error1 | Error2 | Error3>>,
        MessageHandler<State4, Result<State5, Error1 | Error2 | Error3 | Error4>>,
    ]
): MessageHandler<State1, Result<State5, Error1 | Error2 | Error3 | Error4>>
export function composeResultMessageHandlers<
    State1, Error1,
    State2, Error2,
    State3, Error3,
    State4, Error4,
    State5, Error5,
    State6
>(
    handlers: [
        MessageHandler<State1, Result<State2, Error1>>,
        MessageHandler<State2, Result<State3, Error1 | Error2>>,
        MessageHandler<State3, Result<State4, Error1 | Error2 | Error3>>,
        MessageHandler<State4, Result<State5, Error1 | Error2 | Error3 | Error4>>,
        MessageHandler<State5, Result<State6, Error1 | Error2 | Error3 | Error4 | Error5>>,
    ]
): MessageHandler<State1, Result<State6, Error1 | Error2 | Error3 | Error4 | Error5>>
export function composeResultMessageHandlers<
    State1, Error1,
    State2, Error2,
    State3, Error3,
    State4, Error4,
    State5, Error5,
    State6, Error6,
    State7
>(
    handlers: [
        MessageHandler<State1, Result<State2, Error1>>,
        MessageHandler<State2, Result<State3, Error1 | Error2>>,
        MessageHandler<State3, Result<State4, Error1 | Error2 | Error3>>,
        MessageHandler<State4, Result<State5, Error1 | Error2 | Error3 | Error4>>,
        MessageHandler<State5, Result<State6, Error1 | Error2 | Error3 | Error4 | Error5>>,
        MessageHandler<State6, Result<State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>>,
    ]
): MessageHandler<State1, Result<State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>>
export function composeResultMessageHandlers<
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
        MessageHandler<State1, Result<State2, Error1>>,
        MessageHandler<State2, Result<State3, Error1 | Error2>>,
        MessageHandler<State3, Result<State4, Error1 | Error2 | Error3>>,
        MessageHandler<State4, Result<State5, Error1 | Error2 | Error3 | Error4>>,
        MessageHandler<State5, Result<State6, Error1 | Error2 | Error3 | Error4 | Error5>>,
        MessageHandler<State6, Result<State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>>,
        MessageHandler<State7, Result<State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>>,
    ]
): MessageHandler<State1, Result<State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>>
export function composeResultMessageHandlers<
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
        MessageHandler<State1, Result<State2, Error1>>,
        MessageHandler<State2, Result<State3, Error1 | Error2>>,
        MessageHandler<State3, Result<State4, Error1 | Error2 | Error3>>,
        MessageHandler<State4, Result<State5, Error1 | Error2 | Error3 | Error4>>,
        MessageHandler<State5, Result<State6, Error1 | Error2 | Error3 | Error4 | Error5>>,
        MessageHandler<State6, Result<State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>>,
        MessageHandler<State7, Result<State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>>,
        MessageHandler<State8, Result<State9, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>>,
    ]
): MessageHandler<State1, Result<State9, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>>
export function composeResultMessageHandlers<
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
        MessageHandler<State1, Result<State2, Error1>>,
        MessageHandler<State2, Result<State3, Error1 | Error2>>,
        MessageHandler<State3, Result<State4, Error1 | Error2 | Error3>>,
        MessageHandler<State4, Result<State5, Error1 | Error2 | Error3 | Error4>>,
        MessageHandler<State5, Result<State6, Error1 | Error2 | Error3 | Error4 | Error5>>,
        MessageHandler<State6, Result<State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>>,
        MessageHandler<State7, Result<State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>>,
        MessageHandler<State8, Result<State9, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>>,
        MessageHandler<State9, Result<State10, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9>>,
    ]
): MessageHandler<State1, Result<State10, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9>>
export function composeResultMessageHandlers<
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
        MessageHandler<State1, Result<State2, Error1>>,
        MessageHandler<State2, Result<State3, Error1 | Error2>>,
        MessageHandler<State3, Result<State4, Error1 | Error2 | Error3>>,
        MessageHandler<State4, Result<State5, Error1 | Error2 | Error3 | Error4>>,
        MessageHandler<State5, Result<State6, Error1 | Error2 | Error3 | Error4 | Error5>>,
        MessageHandler<State6, Result<State7, Error1 | Error2 | Error3 | Error4 | Error5 | Error6>>,
        MessageHandler<State7, Result<State8, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7>>,
        MessageHandler<State8, Result<State9, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8>>,
        MessageHandler<State9, Result<State10, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9>>,
        MessageHandler<State10, Result<State11, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9 | Error10>>,
    ]
): MessageHandler<State1, Result<State11, Error1 | Error2 | Error3 | Error4 | Error5 | Error6 | Error7 | Error8 | Error9 | Error10>>
export function composeResultMessageHandlers(
    handlers: ReadonlyArray<MessageHandler<any, Result<any, any>>>
): MessageHandler<any, Result<any, any>> {
    return async (message, state) => {
        const cleanups: Cleanup[] = []
        for (const handler of handlers) {
            const result = await handler(message, state)
            if (result.cleanup !== undefined) {
                cleanups.push(result.cleanup)
            }
            if (!result.state.ok) {
                return composeCleanupResponse(result.state, cleanups)
            }
            state = result.state.value
        }
        return composeCleanupResponse(ok(state), cleanups)
    }
}


export function fallthroughMessageHandler<ExistingState, NewState, Next>(
    handlers: ReadonlyArray<MessageHandler<ExistingState, NewState | Next>>,
    isNext: (state: Readonly<NewState | Next>) => state is Next,
    noMatch: NewState
): MessageHandler<ExistingState, NewState> {
    return async (message, state) => {
        const cleanups: Cleanup[] = []
        for (const handler of handlers) {
            const result = await handler(message, state)
            if (result.cleanup !== undefined) {
                cleanups.push(result.cleanup)
            }
            if (isNext(result.state)) {
                continue
            }
            return composeCleanupResponse(result.state, cleanups)
        }
        return composeCleanupResponse(noMatch, cleanups)
    }
}


function composeCleanupResponse<T>(state: T, cleanups: ReadonlyArray<Cleanup>): MessageHandlerResult<T> {
    return response(
        state,
        cleanups.length === 0
            ? undefined
            : async (message, state) => {
                for (let index = cleanups.length - 1; index >= 0; index--) {
                    await cleanups[index]!(message, state)
                }
            }
    )
}
