import type { ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'

import WebSocket from 'ws'
import { ok, Result } from 'fallible'

import type {
    AwaitableRequestListener,
    Cleanup,
    ExceptionListener,
    MessageHandler,
    MessageHandlerResult,
    Response,
    WebsocketIterable,
    WebsocketSendErrorCallback,
    IdentifiedWebsocket,
    WebsocketData
} from './types.js'
import { cookieHeader, WebsocketReadyState, response } from './general-utils.js'


function warn(message: string): void {
    console.warn(`fallible-server: ${message}`)
}


function defaultOnWebsocketSendError(
    _data: WebsocketData,
    { name, message }: Error
): void {
    warn("Unknown error sending Websocket message. Consider adding an 'onSendError' callback to your response")
    warn(name)
    warn(message)
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


async function sendAndHandleError(
    socket: Socket,
    data: WebsocketData,
    onError: WebsocketSendErrorCallback
): Promise<void> {
    const error = await socket.send(data)
    if (error !== undefined) {
        return onError(data, error, socket.uuid)
    }
}


async function sendWebsocketMessages(
    socket: Socket,
    messages: WebsocketIterable,
    onError: WebsocketSendErrorCallback = defaultOnWebsocketSendError
): Promise<void> {
    const promises: Promise<void>[] = []

    for await (const message of messages) {
        if (socket.readyState !== WebsocketReadyState.Open) {
            break
        }
        const promise = sendAndHandleError(socket, message, onError)
        promises.push(promise)
    }

    await Promise.all(promises)
}


function getDefaultExceptionListener(): ExceptionListener {
    warn("default exception listener will be used. Consider overriding via the 'exceptionListener' option")
    return console.error
}


class Socket implements IdentifiedWebsocket {
    public readonly uuid = randomUUID()

    public constructor(
        private readonly wrapped: WebSocket
    ) {}

    public get readyState(): WebsocketReadyState {
        return this.wrapped.readyState as WebsocketReadyState
    }

    public send(data: WebsocketData): Promise<Error | undefined> {
        return new Promise(resolve => this.wrapped.send(data, resolve))
    }

    public close(code?: number, reason?: string): Promise<void> {
        return new Promise(resolve => {
            this.wrapped.on('close', () => resolve())
            this.wrapped.close(code, reason)
        })
    }
}


export function createRequestListener(
    messageHandler: MessageHandler,
    exceptionListener = getDefaultExceptionListener()
): [ AwaitableRequestListener, ReadonlyMap<string, IdentifiedWebsocket> ] {
    const server = new WebSocket.Server({ noServer: true })
    const sockets = new Map<string, Socket>()

    const listener: AwaitableRequestListener = async (req, res) => {
        let state: Response
        let cleanup: Cleanup | undefined
        try {
            ({ state, cleanup } = await messageHandler(req, undefined, sockets))
        }
        catch (exception) {
            exceptionListener(exception, req)
            res.statusCode = 500
            res.setHeader('Content-Length', 0)
            try {
                await new Promise<void>((resolve, reject) => {
                    res.on('close', resolve)
                    res.on('error', reject)
                    res.end()
                })
            }
            catch (exception) {
                exceptionListener(exception, req)
            }
            return
        }

        res.statusCode = state.status ?? 200

        if (typeof state.body === 'string') {
            setResponseHeaders(res, state)
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8')
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', Buffer.byteLength(state.body))
            }
            try {
                await new Promise<void>((resolve, reject) => {
                    res.on('close', resolve)
                    res.on('error', reject)
                    res.end(state.body, 'utf-8')
                })
            }
            catch (exception) {
                exceptionListener(exception, req, state)
            }
        }
        else if (state.body instanceof Uint8Array) {
            setResponseHeaders(res, state)
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/octet-stream')
            }
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', state.body.byteLength)
            }
            try {
                await new Promise<void>((resolve, reject) => {
                    res.on('close', resolve)
                    res.on('error', reject)
                    res.end(state.body)
                })
            }
            catch (exception) {
                exceptionListener(exception, req, state)
            }
        }
        // no body
        else if (state.body === undefined) {
            setResponseHeaders(res, state)
            if (!res.hasHeader('Content-Length')) {
                res.setHeader('Content-Length', 0)
            }
            try {
                await new Promise<void>((resolve, reject) => {
                    res.on('close', resolve)
                    res.on('error', reject)
                    res.end()
                })
            }
            catch (exception) {
                exceptionListener(exception, req, state)
            }
        }
        // websocket
        else if ('onOpen' in state.body) {
            const websocket = await new Promise<WebSocket>(resolve =>
                server.handleUpgrade(
                    req,
                    req.socket,
                    Buffer.alloc(0),
                    resolve
                )
            )
            const socket = new Socket(websocket)
            sockets.set(socket.uuid, socket)

            const { onOpen, onMessage, onSendError, onClose } = state.body

            if (onMessage !== undefined) {
                websocket.on('message', data =>
                    sendWebsocketMessages(
                        socket,
                        onMessage(data, socket.uuid),
                        onSendError
                    )
                )
            }

            // no need to listen for the socket error event as close event is
            // always called on errors anyway. see:
            // https://github.com/websockets/ws/issues/1823#issuecomment-740056036

            const [ closeReason, ] = await Promise.all([
                new Promise<[ number, string ]>(resolve =>
                    websocket.on('close', (...args) => resolve(args))
                ),
                // the 'open' even is never fired when running in noServer
                // mode, so just call onOpen straight away as the request
                // is already opened
                sendWebsocketMessages(
                    socket,
                    onOpen(socket.uuid),
                    onSendError
                )
            ])

            sockets.delete(socket.uuid)

            if (onClose !== undefined) {
                await onClose(...closeReason, socket.uuid)
            }
        }
        // iterable
        else {
            setResponseHeaders(res, state)
            if (!res.hasHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/octet-stream')
            }
            const iterable = typeof state.body === 'function'
                ? state.body()
                : state.body
            const stream = iterable instanceof Readable
                ? iterable
                : Readable.from(iterable, { objectMode: false })
            try {
                await new Promise<void>((resolve, reject) => {
                    const errorHandler = (error: unknown): void => {
                        res.off('error', errorHandler)
                        stream.off('error', errorHandler)
                        stream.unpipe(res)
                        res.end()
                        reject(error)
                    }
                    res.on('close', resolve)
                    res.once('error', errorHandler)
                    stream.once('error', errorHandler)
                    stream.pipe(res)
                })
            }
            catch (exception) {
                exceptionListener(exception, req, state)
            }
        }

        if (cleanup !== undefined) {
            await cleanup()
        }
    }

    return [ listener, sockets ]
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
    return async (message, state, sockets) => {
        const cleanups: Cleanup[] = []
        for (const handler of handlers) {
            const result = await handler(message, state, sockets)
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
    return async (message, state, sockets) => {
        const cleanups: Cleanup[] = []
        for (const handler of handlers) {
            const result = await handler(message, state, sockets)
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
    return async (message, state, sockets) => {
        const cleanups: Cleanup[] = []
        for (const handler of handlers) {
            const result = await handler(message, state, sockets)
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
    return response(state, async () => {
        for (let index = cleanups.length - 1; index >= 0; index--) {
            await cleanups[index]!()
        }
    })
}
