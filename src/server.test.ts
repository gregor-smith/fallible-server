import { TextEncoder } from 'node:util'
import { setTimeout } from 'node:timers/promises'

import 'jest-extended'
import { error, ok, Ok, Result } from 'fallible'
import { Response as MockResponse } from 'mock-http'
import WebSocket from 'ws'

import { response, websocketResponse } from './general-utils.js'
import {
    composeMessageHandlers,
    composeResultMessageHandlers,
    createRequestListener,
    fallthroughMessageHandler
} from './server.js'
import type { Message, MessageHandler, Response, WebsocketData, WebsocketIterable } from './types.js'
import { Readable } from 'node:stream'
import { createServer } from 'node:http'


const testEncoder = new TextEncoder()
const testResponse = {
    status: 418,
    headers: {
        'test-header': 'test header value',
        'test-header-2': 'test header value 2'
    }
} as const


describe('createRequestListener', () => {
    const originalConsoleWarn = console.warn
    const originalConsoleError = console.error

    const consoleWarnMock = jest.fn<void, Parameters<Console['warn']>>()
    const consoleErrorMock = jest.fn<void, Parameters<Console['error']>>()

    beforeEach(() => {
        console.warn = consoleWarnMock
        console.error = consoleErrorMock
    })
    afterEach(() => {
        console.warn = originalConsoleWarn
        console.error = originalConsoleError
        consoleWarnMock.mockReset()
        consoleErrorMock.mockReset()
    })

    describe('shared', () => {
        test('exceptionListener called and response ended when messageHandler throws', async () => {
            expect.assertions(8)

            const response = new MockResponse()
            const handlerException = new Error('test')

            const [ listener, testSockets ] = createRequestListener(
                (message, _, sockets) => {
                    expect(message).toBe(response.req)
                    expect(sockets).toBe(testSockets)
                    throw handlerException
                },
                (exception, message, state) => {
                    expect(exception).toBe(handlerException)
                    expect(message).toBe(response.req)
                    expect(state).toBeUndefined()
                }
            )

            await listener(response.req, response)

            expect(response._internal.ended).toBeTrue()
            expect(response.statusCode).toBe(500)
            expect(response._internal.headers).toContainEntry([ 'content-length', 0 ])
        })

        test('exceptionListener called again when ending response throws', async () => {
            expect.assertions(4)

            const handlerException = new Error('handler error')
            const endException = new Error('end error')
            const response = new MockResponse({
                onEnd: () => { response.emit('error', endException) }
            })
            const exceptionListener = jest.fn<void, [ unknown, Message, Response | undefined ]>()

            const [ listener ] = createRequestListener(
                () => { throw handlerException },
                exceptionListener
            )

            await listener(response.req, response)

            expect(response._internal.ended).toBeTrue()
            expect(response.statusCode).toBe(500)
            expect(response._internal.headers).toContainEntry([ 'content-length', 0 ])
            expect(exceptionListener.mock.calls).toEqual([
                [ handlerException, response.req ],
                [ endException, response.req ]
            ])
        })

        test('default exception handler used when none given as parameter', async () => {
            expect.assertions(2)

            const exception = new Error('test')
            const [ listener ] = createRequestListener(() => { throw exception })
            const response = new MockResponse()
            await listener(response.req, response)

            expect(consoleWarnMock.mock.calls).toEqual([
                [ "fallible-server: default exception listener will be used. Consider overriding via the 'exceptionListener' option" ]
            ])
            expect(consoleErrorMock.mock.calls).toEqual([
                [ exception, response.req ]
            ])
        })

        test.todo('messageHandler sockets parameter')
    })

    describe('string body', () => {
        const body = 'test 🤔'

        test('writes default status, content type, content length', async () => {
            expect.assertions(5)

            const cleanup = jest.fn()
            const [ listener ] = createRequestListener(() =>
                response({ body }, cleanup)
            )
            const res = new MockResponse()
            await listener(res.req, res)

            expect(res._internal.ended).toBeTrue()
            expect(res.statusCode).toBe(200)
            expect(res._internal.buffer.toString('utf-8')).toEqual(body)
            expect(res._internal.headers).toContainEntries([
                [ 'content-type', 'text/html; charset=utf-8' ],
                [ 'content-length', Buffer.byteLength(body) ]
            ])
            expect(cleanup).toHaveBeenCalledOnce()
        })

        test('writes custom status, headers', async () => {
            expect.assertions(2)

            const [ listener ] = createRequestListener(() =>
                response({ ...testResponse, body })
            )
            const res = new MockResponse()
            await listener(res.req, res)

            expect(res.statusCode).toBe(testResponse.status)
            expect(res._internal.headers).toContainEntries(
                Object.entries(testResponse.headers)
            )
        })

        test('exceptionListener called when response errors', async () => {
            expect.assertions(3)

            const cleanup = jest.fn()
            const exceptionListener = jest.fn()
            const [ listener ] = createRequestListener(
                () => response({ body }, cleanup),
                exceptionListener
            )
            const exception = new Error('end error')
            const res = new MockResponse({
                onEnd: () => { res.emit('error', exception) }
            })
            await listener(res.req, res)

            expect(res._internal.ended).toBeTrue()
            expect(exceptionListener.mock.calls).toEqual([
                [ exception, res.req, { body } ]
            ])
            expect(cleanup).toHaveBeenCalledOnce()
        })
    })

    describe('uint8array body', () => {
        const stringBody = 'test 🤔'
        const bodies = [
            Buffer.from(stringBody, 'utf-8'),
            testEncoder.encode(stringBody)
        ]

        test.each(bodies)('writes default status, content type, content length', async body => {
            expect.assertions(5)

            const cleanup = jest.fn()
            const [ listener ] = createRequestListener(() =>
                response({ body }, cleanup)
            )
            const res = new MockResponse()
            await listener(res.req, res)

            expect(res._internal.ended).toBeTrue()
            expect(res.statusCode).toBe(200)
            expect(res._internal.buffer.toString('utf-8')).toEqual(stringBody)
            expect(res._internal.headers).toContainEntries([
                [ 'content-type', 'application/octet-stream' ],
                [ 'content-length', body.byteLength ]
            ])
            expect(cleanup).toHaveBeenCalledOnce()
        })

        test.each(bodies)('writes custom status, headers', async body => {
            expect.assertions(2)

            const [ listener ] = createRequestListener(() =>
                response({ ...testResponse, body })
            )
            const res = new MockResponse()
            await listener(res.req, res)

            expect(res.statusCode).toBe(testResponse.status)
            expect(res._internal.headers).toContainEntries(
                Object.entries(testResponse.headers)
            )
        })

        test.each(bodies)('exceptionListener called when response errors', async body => {
            expect.assertions(3)

            const cleanup = jest.fn()
            const exceptionListener = jest.fn()
            const [ listener ] = createRequestListener(
                () => response({ body }, cleanup),
                exceptionListener
            )
            const exception = new Error('end error')
            const res = new MockResponse({
                onEnd: () => { res.emit('error', exception) }
            })
            await listener(res.req, res)

            expect(res._internal.ended).toBeTrue()
            expect(exceptionListener.mock.calls).toEqual([
                [ exception, res.req, { body } ]
            ])
            expect(cleanup).toHaveBeenCalledOnce()
        })
    })

    describe('no body', () => {
        test('writes default status, content type, content length', async () => {
            expect.assertions(5)

            const cleanup = jest.fn()
            const [ listener ] = createRequestListener(() =>
                response({}, cleanup)
            )
            const res = new MockResponse()
            await listener(res.req, res)

            expect(res._internal.ended).toBeTrue()
            expect(res.statusCode).toBe(200)
            expect(res._internal.buffer).toBeEmpty()
            expect(res._internal.headers).toContainEntry([ 'content-length', 0 ])
            expect(cleanup).toHaveBeenCalledOnce()
        })

        test('writes custom status, headers', async () => {
            expect.assertions(2)

            const [ listener ] = createRequestListener(() => response(testResponse))
            const res = new MockResponse()
            await listener(res.req, res)

            expect(res.statusCode).toBe(testResponse.status)
            expect(res._internal.headers).toContainEntries(
                Object.entries(testResponse.headers)
            )
        })

        test('exceptionListener called when response errors', async () => {
            expect.assertions(3)

            const cleanup = jest.fn()
            const exceptionListener = jest.fn()
            const [ listener ] = createRequestListener(
                () => response({}, cleanup),
                exceptionListener
            )
            const exception = new Error('end error')
            const res = new MockResponse({
                onEnd: () => { res.emit('error', exception) }
            })
            await listener(res.req, res)

            expect(res._internal.ended).toBeTrue()
            expect(exceptionListener.mock.calls).toEqual([
                [ exception, res.req, {} ]
            ])
            expect(cleanup).toHaveBeenCalledOnce()
        })
    })

    describe('stream body', () => {
        function yieldsTenGenerator<T>(value: T): () => Generator<T, void> {
            return function * () {
                for (let i = 0; i < 10; i++) {
                    yield value
                }
            }
        }

        function toAsyncGenerator<T>(func: () => Generator<T>): () => AsyncGenerator<T, void> {
            return async function * () {
                yield * func()
            }
        }

        const stringBody = 'test 🤔'
        const uint8ArrayGenerator = yieldsTenGenerator(testEncoder.encode(stringBody))
        const bufferGenerator = yieldsTenGenerator(Buffer.from(stringBody, 'utf-8'))
        const generators = [
            uint8ArrayGenerator,
            bufferGenerator,
            toAsyncGenerator(uint8ArrayGenerator),
            toAsyncGenerator(bufferGenerator)
        ]
        const bodies = [
            ...generators,
            ...generators.map(generator => generator()),
            ...generators.map(generator => Readable.from(generator()))
        ]

        test.each(bodies)('writes default status, content length', async body => {
            expect.assertions(5)

            const cleanup = jest.fn()
            const [ listener ] = createRequestListener(() =>
                response({ body }, cleanup)
            )
            const res = new MockResponse()
            await listener(res.req, res)

            expect(res._internal.ended).toBeTrue()
            expect(res.statusCode).toBe(200)
            expect(res._internal.buffer.toString('utf-8')).toEqual(stringBody.repeat(10))
            expect(res._internal.headers).toContainEntry(
                [ 'content-type', 'application/octet-stream' ]
            )
            expect(cleanup).toHaveBeenCalledOnce()
        })

        test.each(bodies)('writes custom status, headers', async body => {
            expect.assertions(2)

            const [ listener ] = createRequestListener(() =>
                response({ ...testResponse, body })
            )
            const res = new MockResponse()
            await listener(res.req, res)

            expect(res.statusCode).toBe(testResponse.status)
            expect(res._internal.headers).toContainEntries(
                Object.entries(testResponse.headers)
            )
        })

        const exception = new Error('test')

        function errorGenerator<T>(func: () => Generator<T>): () => Generator<T, void> {
            return function * () {
                yield * func()
                throw exception
            }
        }

        const errorUint8ArrayGenerator = errorGenerator(uint8ArrayGenerator)
        const errorBufferGenerator = errorGenerator(bufferGenerator)
        const errorGenerators = [
            errorUint8ArrayGenerator,
            errorBufferGenerator,
            toAsyncGenerator(errorUint8ArrayGenerator),
            toAsyncGenerator(errorBufferGenerator)
        ]
        const errorBodies = [
            ...errorGenerators,
            ...errorGenerators.map(generator => generator()),
            ...errorGenerators.map(generator => Readable.from(generator()))
        ]
        test.each(errorBodies)('exceptionListener called when stream errors', async body => {
            expect.assertions(6)

            const cleanup = jest.fn()
            const exceptionListener = jest.fn()
            const [ listener ] = createRequestListener(
                () => response({ body }, cleanup),
                exceptionListener
            )
            const res = new MockResponse()
            await listener(res.req, res)

            expect(res._internal.ended).toBeTrue()
            expect(res.statusCode).toBe(200)
            expect(res._internal.buffer.toString('utf-8')).toEqual(stringBody.repeat(10))
            expect(res._internal.headers).toContainEntry(
                [ 'content-type', 'application/octet-stream' ]
            )
            expect(exceptionListener.mock.calls).toEqual([
                [ exception, res.req, { body } ]
            ])
            expect(cleanup).toHaveBeenCalledOnce()
        })

        test.todo('exceptionListener called when response errors')
    })

    describe('websockets', () => {
        const server = createServer()

        beforeAll(done => {
            server.listen(0, '127.0.0.1', done)
        })
        afterEach(() => {
            server.removeAllListeners('request')
        })
        afterAll(done => {
            server.close(done)
        })

        function connectWebsocket(): WebSocket {
            const addressInfo = server.address()
            if (addressInfo === null || typeof addressInfo !== 'object') {
                throw new Error(`Invalid server address: ${addressInfo}`)
            }
            const uri = `ws://${addressInfo.address}:${addressInfo.port}`
            return new WebSocket(uri)
        }

        test('onOpen called, onClose called, messages sent and received', async () => {
            expect.assertions(7)

            const messages: WebsocketData[] = []
            let uuid: string | undefined

            const onOpen = jest.fn<WebsocketIterable, [ string ]>(function * (u) {
                uuid = u
                yield 'server open'
                yield 'server open 2'
            })
            const onClose = jest.fn<void, [ number, string, string ]>()
            const onMessage = jest.fn<WebsocketIterable, [ WebsocketData, string ]>(function * (message) {
                yield 'server message'
                yield `server echo: ${message}`
            })

            await new Promise<void>(resolve => {
                // Simply listening for the client close event is not enough,
                // as the server request listener has not yet returned at that
                // point. We get around this by both listening for the client
                // close event and using the messageHandler's cleanup callback.
                // Conveniently, this also tests that the cleanup called, as
                // this test would fail with a timeout error otherwise.
                let done = false

                function waitForOtherToFinish(): void {
                    if (done) {
                        resolve()
                    }
                    else {
                        done = true
                    }
                }

                const [ listener ] = createRequestListener(() =>
                    websocketResponse(
                        { onOpen, onMessage, onClose },
                        waitForOtherToFinish
                    )
                )
                server.addListener('request', listener)

                const client = connectWebsocket()
                client.on('open', () => client.send('client open'))
                client.on('message', message => {
                    messages.push(message)
                    if (messages.length >= 4) {
                        client.close(4321, 'client close')
                    }
                })
                client.on('close', waitForOtherToFinish)
            })

            expect(uuid).not.toBeUndefined()
            expect(onOpen).toHaveBeenCalledOnce()
            expect(onOpen).toHaveBeenCalledBefore(onMessage)
            expect(onMessage.mock.calls).toEqual([ [ 'client open', uuid ] ])
            expect(messages).toEqual([
                'server open',
                'server open 2',
                'server message',
                'server echo: client open'
            ])
            expect(onClose).toHaveBeenCalledAfter(onMessage)
            expect(onClose.mock.calls).toEqual([ [ 4321, 'client close', uuid ] ])
        })

        test('closing using uuid passed to onOpen', async () => {
            expect.assertions(1)

            const closeInfo = await new Promise<[ number, string ]>(resolve => {
                let serverDone = false
                let clientCloseInfo: [ number, string ] | undefined

                const [ listener ] = createRequestListener((_message, _state, sockets) =>
                    websocketResponse(
                        {
                            onOpen: function * (uuid) {
                                return sockets.get(uuid)
                                    ?.close(4321, 'server close')
                            }
                        },
                        () => {
                            if (clientCloseInfo === undefined) {
                                serverDone = true
                            }
                            else {
                                resolve(clientCloseInfo)
                            }
                        }
                    )
                )
                server.addListener('request', listener)

                const client = connectWebsocket()
                client.on('close', (...args) => {
                    if (serverDone) {
                        resolve(args)
                    }
                    else {
                        clientCloseInfo = args
                    }
                })
            })

            expect(closeInfo).toEqual([ 4321, 'server close' ])
        })

        test('closing using uuid passed to onMessage', async () => {
            expect.assertions(2)

            const messages: WebsocketData[] = []

            const closeInfo = await new Promise<[ number, string ]>(resolve => {
                let serverDone = false
                let clientCloseInfo: [ number, string ] | undefined

                const [ listener ] = createRequestListener((_message, _state, sockets) =>
                    websocketResponse(
                        {
                            onOpen: function * () {},
                            onMessage: async function * (message, uuid) {
                                messages.push(message)
                                await sockets.get(uuid)?.close(4321, 'server close')
                            }
                        },
                        () => {
                            if (clientCloseInfo === undefined) {
                                serverDone = true
                            }
                            else {
                                resolve(clientCloseInfo)
                            }
                        }
                    )
                )
                server.addListener('request', listener)

                const client = connectWebsocket()
                client.on('open', () => client.send('client open'))
                client.on('close', (...args) => {
                    if (serverDone) {
                        resolve(args)
                    }
                    else {
                        clientCloseInfo = args
                    }
                })
            })

            expect(messages).toEqual([ 'client open' ])
            expect(closeInfo).toEqual([ 4321, 'server close' ])
        })

        test('stops sending messages if socket closes during generator', async () => {
            expect.assertions(2)

            const messages: WebsocketData[] = []
            const onClose = jest.fn<void, [ number, string, string ]>()

            await new Promise<void>(resolve => {
                let done = false

                function waitForOtherToFinish() {
                    if (done) {
                        resolve()
                    }
                    else {
                        done = true
                    }
                }

                const [ listener ] = createRequestListener(() =>
                    websocketResponse(
                        {
                            onOpen: async function * () {
                                yield 'server open'
                                await setTimeout(5)
                                yield 'should be unreachable'
                            },
                            onClose
                        },
                        waitForOtherToFinish
                    )
                )
                server.addListener('request', listener)

                const client = connectWebsocket()
                client.on('message', message => {
                    messages.push(message)
                    client.close(4321, 'client close')
                })
                client.on('close', waitForOtherToFinish)
            })

            expect(messages).toEqual([ 'server open' ])
            expect(onClose.mock.calls).toEqual([
                [ 4321, 'client close', expect.any(String) ]
            ])
        })

        test('onSendError called on unknown send error', async () => {
            expect.assertions(5)

            const onSendError = jest.fn<void, [ WebsocketData, Error, string ]>(() => {})
            const onMessage = jest.fn<void, [ string ]>()
            const exception = new Error('test')
            const sendSpy = jest.spyOn(WebSocket.prototype, 'send')
                // The wrong overload is inferred so the second
                // parameter must be typed as any
                .mockImplementation((_, callback: any) => callback(exception))

            let uuid: string | undefined

            const closeInfo = await new Promise<[ number, string ]>(resolve => {
                let serverDone = false
                let clientCloseInfo: [ number, string ] | undefined

                const [ listener ] = createRequestListener((_message, _state, sockets) =>
                    websocketResponse(
                        {
                            onOpen: async function * (u) {
                                uuid = u
                                yield 'a'
                                yield 'b'
                                yield 'c'
                                await sockets.get(uuid)?.close(4321, 'server close')
                            },
                            onSendError
                        },
                        () => {
                            if (clientCloseInfo === undefined) {
                                serverDone = true
                            }
                            else {
                                resolve(clientCloseInfo)
                            }
                        }
                    )
                )
                server.addListener('request', listener)

                const client = connectWebsocket()
                client.on('message', onMessage)
                client.on('close', (...args) => {
                    if (serverDone) {
                        resolve(args)
                    }
                    else {
                        clientCloseInfo = args
                    }
                })
            })

            expect(uuid).not.toBeUndefined()
            expect(onMessage).not.toHaveBeenCalled()
            expect(sendSpy.mock.calls).toEqual([
                [ 'a', expect.any(Function) ],
                [ 'b', expect.any(Function) ],
                [ 'c', expect.any(Function) ],
            ])
            expect(onSendError.mock.calls).toEqual([
                [ 'a', exception, uuid ],
                [ 'b', exception, uuid ],
                [ 'c', exception, uuid ]
            ])
            expect(closeInfo).toEqual([ 4321, 'server close' ])
        })
    })
})


describe('composeMessageHandlers', () => {
    test('handlers called in order with message, sockets and each successive state', async () => {
        expect.assertions(11)

        const testMessage = Symbol() as any
        const testSockets = Symbol() as any

        const a: MessageHandler<void, number> = (message, state, sockets) => {
            expect(message).toBe(testMessage)
            expect(state).toBeUndefined()
            expect(sockets).toBe(testSockets)
            return response(1)
        }
        const b: MessageHandler<number, number> = (message, state, sockets) => {
            expect(message).toBe(testMessage)
            expect(state).toBe(1)
            expect(sockets).toBe(testSockets)
            return response(2)
        }
        const c: MessageHandler<number, number> = (message, state, sockets) => {
            expect(message).toBe(testMessage)
            expect(state).toBe(2)
            expect(sockets).toBe(testSockets)
            return response(3)
        }

        const composed = composeMessageHandlers([ a, b, c ])
        const { state, cleanup } = await composed(testMessage, undefined, testSockets)

        expect(cleanup).toBeFunction()
        expect(state).toBe(3)
    })

    test('cleanup calls handler cleanups in reverse order', async () => {
        expect.assertions(5)

        const aCleanup = jest.fn<void, []>()
        const a: MessageHandler<void, null> = () => response(null, aCleanup)

        const bCleanup = jest.fn<void, []>()
        const b: MessageHandler<null, null> = () => response(null, bCleanup)

        const c: MessageHandler<null, null> = () => response(null)

        const dCleanup = jest.fn<void, []>()
        const d: MessageHandler<null, null> = () => response(null, dCleanup)

        const composed = composeMessageHandlers([ a, b, c, d ])
        const { cleanup } = await composed(undefined as any, undefined, undefined as any)
        await cleanup?.()

        expect(aCleanup).toHaveBeenCalledOnce()
        expect(bCleanup).toHaveBeenCalledOnce()
        expect(dCleanup).toHaveBeenCalledOnce()
        expect(aCleanup).toHaveBeenCalledAfter(bCleanup)
        expect(bCleanup).toHaveBeenCalledAfter(dCleanup)
    })
})


describe('composeResultMessageHandlers', () => {
    test('handlers called in order with message, sockets and each successive state', async () => {
        expect.assertions(11)

        const testMessage = Symbol() as any
        const testSockets = Symbol() as any
        const a: MessageHandler<void, Ok<number>> = (message, state, sockets) => {
            expect(message).toBe(testMessage)
            expect(state).toBeUndefined()
            expect(sockets).toBe(testSockets)
            return response(ok(1))
        }
        const b: MessageHandler<number, Ok<number>> = (message, state, sockets) => {
            expect(message).toBe(testMessage)
            expect(state).toBe(1)
            expect(sockets).toBe(testSockets)
            return response(ok(2))
        }
        const c: MessageHandler<number, Ok<number>> = (message, state, sockets) => {
            expect(message).toBe(testMessage)
            expect(state).toBe(2)
            expect(sockets).toBe(testSockets)
            return response(ok(3))
        }

        const composed = composeResultMessageHandlers([ a, b, c ])
        const { state, cleanup } = await composed(testMessage, undefined, testSockets)

        expect(cleanup).toBeFunction()
        expect(state).toEqual(ok(3))
    })

    test('error response from composed handler is returned immediately', async () => {
        expect.assertions(2)

        const testMessage = Symbol() as any
        const testSockets = Symbol() as any
        const a: MessageHandler<void, Result<number, string>> = () =>
            response(ok(1))
        const b: MessageHandler<number, Result<number, string>> = () =>
            response(ok(2))
        const c: MessageHandler<number, Result<number, string>> = () =>
            response(error('test'))
        const d: MessageHandler<number, Result<number, string>> = () =>
            response(ok(4))

        const composed = composeResultMessageHandlers([ a, b, c, d ])
        const { state, cleanup } = await composed(testMessage, undefined, testSockets)

        expect(cleanup).toBeFunction()
        expect(state).toEqual(error('test'))
    })

    test('cleanup calls handler cleanups in reverse order', async () => {
        expect.assertions(5)

        const aCleanup = jest.fn<void, []>()
        const a: MessageHandler<void, Result<void, unknown>> = () =>
            response(ok(), aCleanup)

        const bCleanup = jest.fn<void, []>()
        const b: MessageHandler<void, Result<void, unknown>> = () =>
            response(ok(), bCleanup)

        const c: MessageHandler<void, Result<void, unknown>> = () =>
            response(ok())

        const dCleanup = jest.fn<void, []>()
        const d: MessageHandler<void, Result<void, unknown>> = () =>
            response(ok(), dCleanup)

        const composed = composeResultMessageHandlers([ a, b, c, d ])
        const { cleanup } = await composed(undefined as any, undefined, undefined as any)
        await cleanup?.()

        expect(aCleanup).toHaveBeenCalledOnce()
        expect(bCleanup).toHaveBeenCalledOnce()
        expect(dCleanup).toHaveBeenCalledOnce()
        expect(aCleanup).toHaveBeenCalledAfter(bCleanup)
        expect(bCleanup).toHaveBeenCalledAfter(dCleanup)
    })

    test('error response cleanup calls only previous cleanups in reverse order', async () => {
        expect.assertions(6)

        const aCleanup = jest.fn<void, []>()
        const a: MessageHandler<void, Result<void, unknown>> = () =>
            response(ok(), aCleanup)

        const bCleanup = jest.fn<void, []>()
        const b: MessageHandler<void, Result<void, unknown>> = () =>
            response(ok(), bCleanup)

        const c: MessageHandler<void, Result<void, unknown>> = () =>
            response(ok())

        const dCleanup = jest.fn<void, []>()
        const d: MessageHandler<void, Result<void, unknown>> = () =>
            response(error(), dCleanup)

        const eCleanup = jest.fn<void, []>()
        const e: MessageHandler<void, Result<void, unknown>> = () =>
            response(ok(), eCleanup)

        const composed = composeResultMessageHandlers([ a, b, c, d, e ])
        const { cleanup } = await composed(undefined as any, undefined, undefined as any)
        await cleanup?.()

        expect(aCleanup).toHaveBeenCalledOnce()
        expect(bCleanup).toHaveBeenCalledOnce()
        expect(dCleanup).toHaveBeenCalledOnce()
        expect(eCleanup).not.toHaveBeenCalled()
        expect(aCleanup).toHaveBeenCalledAfter(bCleanup)
        expect(bCleanup).toHaveBeenCalledAfter(dCleanup)
    })
})


describe('fallthroughMessageHandler', () => {
    test("calls handlers in order and returns first response that doesn't match isNext func", async () => {
        expect.assertions(2)

        const a: MessageHandler<void, string> = () => response('test')
        const b: MessageHandler<void, string> = () => response('test2')
        const c: MessageHandler<void, number> = () => response(3)
        const d: MessageHandler<void, string> = () => response('test4')

        const composed = fallthroughMessageHandler<void, number, string>(
            [ a, b, c, d ],
            (state): state is string => typeof state === 'string',
            5
        )
        const { state, cleanup } = await composed(undefined as any, undefined, undefined as any)

        expect(cleanup).toBeFunction()
        expect(state).toBe(3)
    })

    test("returns response with noMatch parameter as state if all handlers' responses match isNext", async () => {
        expect.assertions(2)

        const a: MessageHandler<void, string> = () => response('test')
        const b: MessageHandler<void, string> = () => response('test2')
        const c: MessageHandler<void, string> = () => response('test3')
        const d: MessageHandler<void, string> = () => response('test4')

        const composed = fallthroughMessageHandler<void, number, string>(
            [ a, b, c, d ],
            (state): state is string => typeof state === 'string',
            5
        )
        const { state, cleanup } = await composed(undefined as any, undefined, undefined as any)

        expect(cleanup).toBeFunction()
        expect(state).toBe(5)
    })

    test('cleanup calls cleanups of all handlers up to match', async () => {
        expect.assertions(6)

        const aCleanup = jest.fn<void, []>()
        const a: MessageHandler<void, string> = () => response('test', aCleanup)

        const bCleanup = jest.fn<void, []>()
        const b: MessageHandler<void, string> = () => response('test2', bCleanup)

        const c: MessageHandler<void, string> = () => response('test3')

        const dCleanup = jest.fn<void, []>()
        const d: MessageHandler<void, number> = () => response(4, dCleanup)

        const eCleanup = jest.fn<void, []>()
        const e: MessageHandler<void, string> = () => response('test5', eCleanup)

        const composed = fallthroughMessageHandler<void, number, string>(
            [ a, b, c, d, e ],
            (state): state is string => typeof state === 'string',
            5
        )
        const { cleanup } = await composed(undefined as any, undefined, undefined as any)
        await cleanup?.()

        expect(aCleanup).toHaveBeenCalledOnce()
        expect(bCleanup).toHaveBeenCalledOnce()
        expect(dCleanup).toHaveBeenCalledOnce()
        expect(eCleanup).not.toHaveBeenCalled()
        expect(aCleanup).toHaveBeenCalledAfter(bCleanup)
        expect(bCleanup).toHaveBeenCalledAfter(dCleanup)
    })

    test('cleanup calls cleanups of all handlers on no match', async () => {
        expect.assertions(3)

        const aCleanup = jest.fn<void, []>()
        const a: MessageHandler<void, string> = () => response('test', aCleanup)

        const b: MessageHandler<void, string> = () => response('test2')

        const cCleanup = jest.fn<void, []>()
        const c: MessageHandler<void, string> = () => response('test3', cCleanup)

        const composed = fallthroughMessageHandler<void, number, string>(
            [ a, b, c ],
            (state): state is string => typeof state === 'string',
            4
        )
        const { cleanup } = await composed(undefined as any, undefined, undefined as any)
        await cleanup?.()

        expect(aCleanup).toHaveBeenCalledOnce()
        expect(cCleanup).toHaveBeenCalledOnce()
        expect(aCleanup).toHaveBeenCalledAfter(cCleanup)
    })
})
