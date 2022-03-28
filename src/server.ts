import type { ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'

import WebSocket from 'ws'
import type { Error, Result } from 'fallible'

import type {
    AwaitableRequestListener,
    Cleanup,
    ExceptionListener,
    MessageHandler,
    MessageHandlerResult,
    Response,
    WebsocketIterator,
    WebsocketSendErrorCallback,
    IdentifiedWebsocket,
    WebsocketData,
    Header,
    SocketMap
} from './types.js'
import { WebsocketReadyState, response } from './general-utils.js'


function warn(message: string): void {
    console.warn(`fallible-server: ${message}`)
}


function defaultOnWebsocketSendError(
    _data: WebsocketData,
    { name, message }: globalThis.Error
): void {
    warn("Unknown error sending Websocket message. Consider adding an 'onSendError' callback to your response")
    warn(name)
    warn(message)
}


function setResponseHeaders(res: ServerResponse, headers: Record<string, Header> | undefined): void {
    if (headers !== undefined) {
        for (const [ name, value ] of Object.entries(headers)) {
            const header = Array.isArray(value) ? value.map(String) : String(value)
            res.setHeader(name, header)
        }
    }
}


async function sendWebsocketMessages(
    socket: Socket,
    messages: WebsocketIterator
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


function getDefaultExceptionListener(): ExceptionListener {
    warn("default exception listener will be used. Consider overriding via the 'exceptionListener' option")
    return console.error
}


class Socket implements IdentifiedWebsocket {
    #underlying: WebSocket
    #onSendError: WebsocketSendErrorCallback

    readonly uuid = randomUUID()

    constructor(
        underlying: WebSocket,
        onSendError: WebsocketSendErrorCallback
    ) {
        this.#underlying = underlying
        this.#onSendError = onSendError
    }

    get readyState(): WebsocketReadyState {
        return this.#underlying.readyState as WebsocketReadyState
    }

    async send(data: WebsocketData): Promise<void> {
        const error = await new Promise<globalThis.Error | undefined>(resolve =>
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
 * of a Node `http` `Server`.
 * @param messageHandler
 * A function which takes a Node `http` `IncomingMessage` and returns a `Response`
 * @param exceptionListener
 * A function called if the message handler throws or if the `ServerResponse`
 * fires an `error` event when writing.
 * If not given, prints a warning and `console.error` is used.
 * @returns
 * The callback, and a map of all active WebSockets identified by UUIDs.
 */
export function createRequestListener(
    messageHandler: MessageHandler,
    exceptionListener = getDefaultExceptionListener()
): [ AwaitableRequestListener, SocketMap ] {
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
    handlers: ReadonlyArray<MessageHandler<ExistingState, NewState | Next>>,
    fallback: MessageHandler<ExistingState, NewState>,
    isNext: (state: Readonly<NewState | Next>) => state is Next
): MessageHandler<ExistingState, NewState> {
    return async (message, state, sockets) => {
        const cleanups: (Cleanup | undefined)[] = []
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
    firstHandler: MessageHandler<StateA, StateB>,
    secondHandler: MessageHandler<StateB, StateC>
): MessageHandler<StateA, StateC> {
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
 * Chains together two message handlers that return `Result` states. If the
 * first handler returns a state of `Error`, it is immediately returned. If it
 * returns `Ok`, its value is passed as the state the second handler. Any
 * cleanup functions returned are combined so that the second handler's cleanup
 * is called before the first's.
 * @param firstHandler
 * @param secondHandler
 * @returns
 */
export function composeResultMessageHandlers<StateA, StateB, StateC, ErrorA, ErrorB>(
    firstHandler: MessageHandler<StateA, Result<StateB, ErrorA>>,
    secondHandler: MessageHandler<StateB, Result<StateC, ErrorA | ErrorB>>
): MessageHandler<StateA, Result<StateC, ErrorA | ErrorB>> {
    return async (message, state, sockets) => {
        const firstResult = await firstHandler(message, state, sockets)
        if (!firstResult.state.ok) {
            return firstResult as MessageHandlerResult<Error<ErrorA>>
        }
        const secondResult = await secondHandler(message, firstResult.state.value, sockets)
        return composeCleanupResponse(
            secondResult.state,
            [ firstResult.cleanup, secondResult.cleanup ]
        )
    }
}


function composeCleanupResponse<T>(state: T, cleanups: ReadonlyArray<Cleanup | undefined>): MessageHandlerResult<T> {
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
 * An alternative to `composeMessageHandlers`. Much more elegant when chaining
 * many handlers together. Immutable.
 *
 * The following are equivalent:
 * ```
 * new MessageHandlerComposer(a)
 *      .intoHandler(b)
 *      .intoHandler(c)
 *      .build()
 *
 * composeMessageHandlers(composeMessageHandlers(a, b), c)
 * ```
 */
export class MessageHandlerComposer<ExistingState, NewState> {
    readonly #handler: MessageHandler<ExistingState, NewState>

    constructor(handler: MessageHandler<ExistingState, NewState>) {
        this.#handler = handler
    }

    intoHandler<State>(
        other: MessageHandler<NewState, State>
    ): MessageHandlerComposer<ExistingState, State> {
        const handler = composeMessageHandlers(this.#handler, other)
        return new MessageHandlerComposer(handler)
    }

    build(): MessageHandler<ExistingState, NewState> {
        return this.#handler
    }
}


/**
 * An alternative to `composeResultMessageHandlers`. Much more elegant when
 * chaining many handlers together. Immutable.
 *
 * The following are equivalent:
 * ```
 * new ResultMessageHandlerComposer(a)
 *      .intoResultHandler(b)
 *      .intoHandler(c)
 *      .build()
 *
 * composeMessageHandlers(composeResultMessageHandlers(a, b), c)
 * ```
 */
export class ResultMessageHandlerComposer<ExistingState, NewState, Error>
        extends MessageHandlerComposer<ExistingState, Result<NewState, Error>> {
    intoResultHandler<State, ErrorB>(
        other: MessageHandler<NewState, Result<State, Error | ErrorB>>
    ): ResultMessageHandlerComposer<ExistingState, State, Error | ErrorB> {
        const handler = composeResultMessageHandlers(this.build(), other)
        return new ResultMessageHandlerComposer(handler)
    }
}
