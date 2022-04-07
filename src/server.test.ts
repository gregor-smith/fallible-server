import { TextEncoder } from 'node:util'
import { setTimeout } from 'node:timers/promises'
import { Readable } from 'node:stream'
import { createServer } from 'node:http'

import 'jest-extended'
import { Response as MockResponse } from 'mock-http'
import WebSocket from 'ws'

import { response, webSocketResponse } from './utils.js'
import { createRequestListener } from './server.js'
import type {
    Message,
    Response,
    WebSocketCloseInfo,
    WebSocketData,
    WebSocketIterator,
    WebSocketResponse
} from './types.js'


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
                [ endException, response.req, { status: 500 } ]
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
    })

    describe('string body', () => {
        const body = 'test 🤔'

        test('writes default status, content type, content length', async () => {
            expect.assertions(5)

            const cleanup = jest.fn()
            const state: Response = { body }
            const [ listener ] = createRequestListener(() => response(state, cleanup))
            const res = new MockResponse()
            await listener(res.req, res)

            expect(res._internal.ended).toBeTrue()
            expect(res.statusCode).toBe(200)
            expect(res._internal.buffer.toString('utf-8')).toEqual(body)
            expect(res._internal.headers).toContainEntries([
                [ 'content-type', 'text/html; charset=utf-8' ],
                [ 'content-length', Buffer.byteLength(body) ]
            ])
            expect(cleanup.mock.calls).toEqual([ [ state ] ])
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
            const state: Response = { body }
            const exceptionListener = jest.fn()
            const [ listener ] = createRequestListener(
                () => response(state, cleanup),
                exceptionListener
            )
            const exception = new Error('end error')
            const res = new MockResponse({
                onEnd: () => { res.emit('error', exception) }
            })
            await listener(res.req, res)

            expect(res._internal.ended).toBeTrue()
            expect(exceptionListener.mock.calls).toEqual([
                [ exception, res.req, state ]
            ])
            expect(cleanup.mock.calls).toEqual([ [ state ] ])
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
            const state: Response = { body }
            const [ listener ] = createRequestListener(() => response(state, cleanup))
            const res = new MockResponse()
            await listener(res.req, res)

            expect(res._internal.ended).toBeTrue()
            expect(res.statusCode).toBe(200)
            expect(res._internal.buffer.toString('utf-8')).toEqual(stringBody)
            expect(res._internal.headers).toContainEntries([
                [ 'content-type', 'application/octet-stream' ],
                [ 'content-length', body.byteLength ]
            ])
            expect(cleanup.mock.calls).toEqual([ [ state ] ])
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
            const state: Response = { body }
            const exceptionListener = jest.fn()
            const [ listener ] = createRequestListener(
                () => response(state, cleanup),
                exceptionListener
            )
            const exception = new Error('end error')
            const res = new MockResponse({
                onEnd: () => { res.emit('error', exception) }
            })
            await listener(res.req, res)

            expect(res._internal.ended).toBeTrue()
            expect(exceptionListener.mock.calls).toEqual([
                [ exception, res.req, state ]
            ])
            expect(cleanup.mock.calls).toEqual([ [ state ] ])
        })
    })

    describe('no body', () => {
        test('writes default status, content type, content length', async () => {
            expect.assertions(5)

            const cleanup = jest.fn()
            const state: Response = {}
            const [ listener ] = createRequestListener(() => response(state, cleanup))
            const res = new MockResponse()
            await listener(res.req, res)

            expect(res._internal.ended).toBeTrue()
            expect(res.statusCode).toBe(200)
            expect(res._internal.buffer).toBeEmpty()
            expect(res._internal.headers).toContainEntry([ 'content-length', 0 ])
            expect(cleanup.mock.calls).toEqual([ [ state ] ])
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
            const state: Response = {}
            const exceptionListener = jest.fn()
            const [ listener ] = createRequestListener(
                () => response(state, cleanup),
                exceptionListener
            )
            const exception = new Error('end error')
            const res = new MockResponse({
                onEnd: () => { res.emit('error', exception) }
            })
            await listener(res.req, res)

            expect(res._internal.ended).toBeTrue()
            expect(exceptionListener.mock.calls).toEqual([
                [ exception, res.req, state ]
            ])
            expect(cleanup.mock.calls).toEqual([ [ state ] ])
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
            const state: Response = { body }
            const [ listener ] = createRequestListener(() => response(state, cleanup))
            const res = new MockResponse()
            await listener(res.req, res)

            expect(res._internal.ended).toBeTrue()
            expect(res.statusCode).toBe(200)
            expect(res._internal.buffer.toString('utf-8')).toEqual(stringBody.repeat(10))
            expect(res._internal.headers).toContainEntry(
                [ 'content-type', 'application/octet-stream' ]
            )
            expect(cleanup.mock.calls).toEqual([ [ state ] ])
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
            const state: Response = { body }
            const exceptionListener = jest.fn()
            const [ listener ] = createRequestListener(
                () => response(state, cleanup),
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
                [ exception, res.req, state ]
            ])
            expect(cleanup.mock.calls).toEqual([ [ state ] ])
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
            expect.assertions(8)

            const messages: WebSocketData[] = []
            let uuid: string | undefined

            const onOpen = jest.fn<WebSocketIterator, [ string ]>(function * (u) {
                uuid = u
                yield 'server open'
                yield 'server open 2'
            })
            const onClose = jest.fn<void, [ number, string | Buffer, string ]>()
            const onMessage = jest.fn<WebSocketIterator, [ WebSocketData, string ]>(function * (message) {
                yield 'server message'
                yield `server echo: ${message}`
            })
            const state: WebSocketResponse = { body: { onOpen, onMessage, onClose } }

            const cleanup = jest.fn()

            await new Promise<void>(resolve => {
                // Simply listening for the client close event is not enough,
                // as the server request listener has not yet returned at that
                // point. We get around this by both listening for the client
                // close event and using the messageHandler's cleanup callback.
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
                    response(
                        state,
                        cleanup.mockImplementationOnce(waitForOtherToFinish)
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
            expect(cleanup.mock.calls).toEqual([ [ state ] ])
        })

        test.each<WebSocketCloseInfo>([
            { code: 4321 },
            { code: 4321, reason: 'server close' }
        ])('returning close info from onOpen closes socket', async closeInfo => {
            expect.assertions(1)

            const closeArgs = await new Promise<[ number, string | Buffer ]>(resolve => {
                let serverDone = false
                let clientCloseArgs: [ number, string | Buffer ] | undefined

                const [ listener ] = createRequestListener(() =>
                    webSocketResponse(
                        {
                            onOpen: function * () {
                                return closeInfo
                            }
                        },
                        () => {
                            if (clientCloseArgs === undefined) {
                                serverDone = true
                            }
                            else {
                                resolve(clientCloseArgs)
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
                        clientCloseArgs = args
                    }
                })
            })

            expect(closeArgs).toEqual([ closeInfo.code, closeInfo.reason ?? '' ])
        })

        test.each<WebSocketCloseInfo>([
            { code: 4321 },
            { code: 4321, reason: 'server close' }
        ])('returning close info from onMessage closes socket', async closeInfo => {
            expect.assertions(2)

            const messages: WebSocketData[] = []

            const closeArgs = await new Promise<[ number, string | Buffer ]>(resolve => {
                let serverDone = false
                let clientCloseArgs: [ number, string | Buffer ] | undefined

                const [ listener ] = createRequestListener(() =>
                    webSocketResponse(
                        {
                            onOpen: function * () {},
                            onMessage: function * (message) {
                                messages.push(message)
                                return closeInfo
                            }
                        },
                        () => {
                            if (clientCloseArgs === undefined) {
                                serverDone = true
                            }
                            else {
                                resolve(clientCloseArgs)
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
                        clientCloseArgs = args
                    }
                })
            })

            expect(messages).toEqual([ 'client open' ])
            expect(closeArgs).toEqual([ closeInfo.code, closeInfo.reason ?? '' ])
        })

        test('stops sending messages if socket closes during generator', async () => {
            expect.assertions(2)

            const messages: WebSocketData[] = []
            const onClose = jest.fn<void, [ number, string | Buffer, string ]>()

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
                    webSocketResponse(
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
            expect.assertions(4)

            const onSendError = jest.fn<void, [ WebSocketData, Error, string ]>(() => {})
            const onMessage = jest.fn<void, [ string ]>()
            const exception = new Error('test')
            const sendSpy = jest.spyOn(WebSocket.prototype, 'send')
                // The wrong overload is inferred so the second
                // parameter must be typed as any
                .mockImplementation((_, callback: any) => callback(exception))

            let uuid: string | undefined

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
                    webSocketResponse(
                        {
                            onOpen: async function * (u) {
                                uuid = u
                                yield 'a'
                                yield 'b'
                                yield 'c'
                                return { code: 1000 }
                            },
                            onSendError
                        },
                        waitForOtherToFinish
                    )
                )
                server.addListener('request', listener)

                const client = connectWebsocket()
                client.on('message', onMessage)
                client.on('close', waitForOtherToFinish)
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
        })
    })
})


describe('parseMultipartRequest', () => {
    test.todo('returns InvalidMultipartContentTypeHeader when content type header invalid')

    test.todo('returns RequestAborted when request aborted during parsing')

    test.todo('returns BelowMinimumFileSize when individual file size lower than minimumFileSize param')

    test.todo('returns MaximumFileCountExceeded when more files than maximumFileCount param')

    test.todo('returns MaximumFileSizeExceeded when individual file size larger than maximumFileSize param')

    test.todo('returns MaximumTotalFileSizeExceeded when combined file size larger than maximumFileSize param * maximumFileCount param')

    test.todo('returns MaximumFieldsCountExceeded when more fields than maximumFieldsCount param')

    test.todo('returns MaximumFieldsSizeExceeded when combined fields larger than maximumFieldsSize param')

    test.todo('returns UnknownError when parsing raises unknown exception')

    test.todo('returns files and fields decoded with given charset')

    test.todo('keepFileExtensions param adds file extensions to returned paths')

    test.todo('saveDirectory param changes returned file paths')
})
