import type http from 'node:http'
import { randomUUID } from 'node:crypto'
import stream from 'node:stream'

import WebSocket from 'ws'
import type * as fallible from 'fallible'

import type * as types from './types.js'
import { WebsocketReadyState, response } from './general-utils.js'


function warn(message: string): void {
    console.warn(`fallible-server: ${message}`)
}


function defaultOnWebsocketSendError(
    _data: types.WebsocketData,
    { name, message }: Error
): void {
    warn("Unknown error sending Websocket message. Consider adding an 'onSendError' callback to your response")
    warn(name)
    warn(message)
}


function setResponseHeaders(
    res: http.ServerResponse,
    headers: Record<string, types.Header> | undefined
): void {
    if (headers !== undefined) {
        for (const [ name, value ] of Object.entries(headers)) {
            const header = Array.isArray(value) ? value.map(String) : String(value)
            res.setHeader(name, header)
        }
    }
}


async function sendWebsocketMessages(
    socket: Socket,
    messages: types.WebsocketIterator
): Promise<void> {
    const promises: Promise<void>[] = []

    while (true) {
        const result = await messages.next()

        if (socket.readyState !== WebsocketReadyState.Open) {
            await Promise.all(promises)
            return
        }

        if (result.done) {
            await Promise.all(promises)
            if (result.value === undefined) {
                return
            }
            return socket.close(result.value.code, result.value.reason)
        }

        const promise = socket.send(result.value)
        promises.push(promise)
    }
}


function getDefaultExceptionListener(): types.ExceptionListener {
    warn("default exception listener will be used. Consider overriding via the 'exceptionListener' option")
    return console.error
}


class Socket implements types.IdentifiedWebsocket {
    #underlying: WebSocket
    #onSendError: types.WebsocketSendErrorCallback

    readonly uuid = randomUUID()

    constructor(
        underlying: WebSocket,
        onSendError: types.WebsocketSendErrorCallback
    ) {
        this.#underlying = underlying
        this.#onSendError = onSendError
    }

    get readyState(): WebsocketReadyState {
        return this.#underlying.readyState as WebsocketReadyState
    }

    async send(data: types.WebsocketData): Promise<void> {
        const error = await new Promise<Error | undefined>(resolve =>
            this.#underlying.send(data, resolve)
        )
        if (error !== undefined) {
            await this.#onSendError(data, error, this.uuid)
        }
    }

    close(code?: number, reason?: string): Promise<void> {
        return new Promise(resolve => {
            this.#underlying.on('close', resolve)
            this.#underlying.close(code, reason)
        })
    }
}


/**
 * Creates a callback intended to be added as a listener to the `request` event
 * of an {@link http.Server}.
 * @param messageHandler
 * A function that takes an {@link http.IncomingMessage IncomingMessage} and
 * returns a {@link types.MessageHandlerResult MessageHandlerResult}. The
 * result may include a {@link types.Cleanup cleanup} function, which is always
 * called after the request has ended, regardless of whether any exceptions
 * occurred. The `Content-Type` header is set by default depending on type of
 * the {@link types.Response response} body: `string` bodies default to
 * `text/html; charset=utf8` while {@link Uint8Array} and
 * {@link types.StreamBody stream} bodies default to `application/octet-stream`.
 * The 'Content-Length' header is also set for all except stream and WebSocket
 * bodies.
 *
 * @param exceptionListener
 * A function called when the message handler throws or the
 * {@link http.ServerResponse ServerResponse} fires an `error` event. If not
 * given, a warning is printed and {@link console.error} is used.
 * @returns
 * The callback, and a map of all active WebSockets identified by UUIDs.
 */
export function createRequestListener(
    messageHandler: types.MessageHandler,
    exceptionListener = getDefaultExceptionListener()
): [ types.AwaitableRequestListener, types.SocketMap ] {
    const server = new WebSocket.Server({ noServer: true })
    const sockets = new Map<string, Socket>()

    const listener: types.AwaitableRequestListener = async (req, res) => {
        let state: types.Response
        let cleanup: types.Cleanup | undefined
        try {
            ({ state, cleanup } = await messageHandler(req, undefined, sockets))
        }
        catch (exception) {
            exceptionListener(exception, req)
            state = { status: 500 }
        }

        res.statusCode = state.status ?? 200

        if (typeof state.body === 'string') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.setHeader('Content-Length', Buffer.byteLength(state.body, 'utf-8'))
            setResponseHeaders(res, state.headers)
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
            res.setHeader('Content-Type', 'application/octet-stream')
            res.setHeader('Content-Length', state.body.byteLength)
            setResponseHeaders(res, state.headers)
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
            res.setHeader('Content-Length', 0)
            setResponseHeaders(res, state.headers)
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
            // TODO: subclass WebSocket.Server and override the handleUpgrade
            // implementation with one that throws rather than ending the socket
            const websocket = await new Promise<WebSocket>(resolve =>
                server.handleUpgrade(
                    req,
                    req.socket,
                    Buffer.alloc(0),
                    resolve
                )
            )

            const { onOpen, onMessage, onSendError, onClose } = state.body

            const socket = new Socket(
                websocket,
                onSendError ?? defaultOnWebsocketSendError
            )
            sockets.set(socket.uuid, socket)

            if (onMessage !== undefined) {
                websocket.on('message', data =>
                    sendWebsocketMessages(
                        socket,
                        onMessage(data, socket.uuid)
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
                    onOpen(socket.uuid)
                )
            ])

            // TODO: keep track of sendWebsocketMessages promises and await here

            sockets.delete(socket.uuid)

            if (onClose !== undefined) {
                await onClose(...closeReason, socket.uuid)
            }
        }
        // iterable
        else {
            res.setHeader('Content-Type', 'application/octet-stream')
            setResponseHeaders(res, state.headers)
            const iterable = typeof state.body === 'function'
                ? state.body()
                : state.body
            const readable = iterable instanceof stream.Readable
                ? iterable
                : stream.Readable.from(iterable, { objectMode: false })
            try {
                await new Promise<void>((resolve, reject) => {
                    const errorHandler = (error: unknown): void => {
                        res.off('error', errorHandler)
                        readable.off('error', errorHandler)
                        readable.unpipe(res)
                        res.end()
                        reject(error)
                    }
                    res.on('close', resolve)
                    res.once('error', errorHandler)
                    readable.once('error', errorHandler)
                    readable.pipe(res)
                })
            }
            catch (exception) {
                exceptionListener(exception, req, state)
            }
        }

        if (cleanup !== undefined) {
            await cleanup(state)
        }
    }

    return [ listener, sockets ]
}


/**
 * Composes an array of message handlers into one. This new handler calls each
 * of the given handlers in the array until one of them returns a state of
 * type `NewState`, which is returned. If all of them return a state of type
 * `Next`, the state from the given fallback handler is returned instead. Any
 * cleanup functions returned by handlers are combined so that invocation
 * executes them in reverse order. Useful for implementing routing.
 * @param handlers
 * Array of handlers that can return responses of either NewState or Next
 * @param fallback
 * A handler that can only return NewState, used if all of the previous
 * handlers return `NewState`
 * @param isNext
 * A type guard used to identify whether the state returned from a handler is
 * of type `Next`
 */
export function fallthroughMessageHandler<ExistingState, NewState, Next>(
    handlers: ReadonlyArray<types.MessageHandler<ExistingState, NewState | Next>>,
    fallback: types.MessageHandler<ExistingState, NewState>,
    isNext: (state: Readonly<NewState | Next>) => state is Next
): types.MessageHandler<ExistingState, NewState> {
    return async (message, state, sockets) => {
        const cleanups: (types.Cleanup | undefined)[] = []
        for (const handler of handlers) {
            const result = await handler(message, state, sockets)
            cleanups.push(result.cleanup)
            if (isNext(result.state)) {
                continue
            }
            return composeCleanupResponse(result.state, cleanups)
        }
        const result = await fallback(message, state, sockets)
        cleanups.push(result.cleanup)
        return composeCleanupResponse(result.state, cleanups)
    }
}


/**
 * Chains together two message handlers into one. The state returned from the
 * first handler is passed to the second handler. Any cleanup functions
 * returned are combined so that the second handler's cleanup is called before
 * the first's.
 */
export function composeMessageHandlers<StateA, StateB, StateC>(
    firstHandler: types.MessageHandler<StateA, StateB>,
    secondHandler: types.MessageHandler<StateB, StateC>
): types.MessageHandler<StateA, StateC> {
    return async (message, state, sockets) => {
        const firstResult = await firstHandler(message, state, sockets)
        const secondResult = await secondHandler(message, firstResult.state, sockets)
        return composeCleanupResponse(
            secondResult.state,
            [ firstResult.cleanup, secondResult.cleanup ]
        )
    }
}


/**
 * Chains together two message handlers that return
 * {@link fallible.Result Result} states. If the first handler returns a state
 * of {@link fallible.Error Error}, it is immediately returned. If it returns
 * {@link fallible.Ok Ok}, its value is passed as the state the second handler.
 * Any cleanup functions returned are combined so that the second handler's
 * cleanup is called before the first's.
 */
export function composeResultMessageHandlers<StateA, StateB, StateC, ErrorA, ErrorB>(
    firstHandler: types.MessageHandler<StateA, fallible.Result<StateB, ErrorA>>,
    secondHandler: types.MessageHandler<StateB, fallible.Result<StateC, ErrorA | ErrorB>>
): types.MessageHandler<StateA, fallible.Result<StateC, ErrorA | ErrorB>> {
    return async (message, state, sockets) => {
        const firstResult = await firstHandler(message, state, sockets)
        if (!firstResult.state.ok) {
            return firstResult as types.MessageHandlerResult<fallible.Error<ErrorA>>
        }
        const secondResult = await secondHandler(message, firstResult.state.value, sockets)
        return composeCleanupResponse(
            secondResult.state,
            [ firstResult.cleanup, secondResult.cleanup ]
        )
    }
}


function composeCleanupResponse<T>(
    state: T,
    cleanups: ReadonlyArray<types.Cleanup | undefined>
): types.MessageHandlerResult<T> {
    return response(state, async state => {
        for (let index = cleanups.length - 1; index >= 0; index--) {
            const cleanup = cleanups[index]
            if (cleanup === undefined) {
                continue
            }
            await cleanup(state)
        }
    })
}


/**
 * An alternative to {@link composeMessageHandlers}. Much more elegant when
 * chaining many handlers together. Immutable.
 *
 * The following are equivalent:
 * ```typescript
 * new MessageHandlerComposer(a)
 *      .intoHandler(b)
 *      .intoHandler(c)
 *      .build()
 *
 * composeMessageHandlers(composeMessageHandlers(a, b), c)
 * ```
 */
export class MessageHandlerComposer<ExistingState, NewState> {
    readonly #handler: types.MessageHandler<ExistingState, NewState>

    constructor(handler: types.MessageHandler<ExistingState, NewState>) {
        this.#handler = handler
    }

    intoHandler<State>(
        other: types.MessageHandler<NewState, State>
    ): MessageHandlerComposer<ExistingState, State> {
        const handler = composeMessageHandlers(this.#handler, other)
        return new MessageHandlerComposer(handler)
    }

    build(): types.MessageHandler<ExistingState, NewState> {
        return this.#handler
    }
}


/**
 * An alternative to {@link composeResultMessageHandlers}. Much more elegant
 * when chaining many handlers together. Immutable.
 *
 * The following are equivalent:
 * ```typescript
 * new ResultMessageHandlerComposer(a)
 *      .intoResultHandler(b)
 *      .intoHandler(c)
 *      .build()
 *
 * composeMessageHandlers(composeResultMessageHandlers(a, b), c)
 * ```
 */
export class ResultMessageHandlerComposer<ExistingState, NewState, Error>
        extends MessageHandlerComposer<ExistingState, fallible.Result<NewState, Error>> {
    intoResultHandler<State, ErrorB>(
        other: types.MessageHandler<NewState, fallible.Result<State, Error | ErrorB>>
    ): ResultMessageHandlerComposer<ExistingState, State, Error | ErrorB> {
        const handler = composeResultMessageHandlers(this.build(), other)
        return new ResultMessageHandlerComposer(handler)
    }
}
