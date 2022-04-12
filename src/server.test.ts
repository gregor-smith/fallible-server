import { TextEncoder } from 'node:util'
import { Readable } from 'node:stream'
import { createServer, IncomingMessage } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'

import 'jest-extended'
import { Response as MockResponse } from 'mock-http'
import { error, ok, Result } from 'fallible'
import WebSocket from 'ws'

import { response } from './utils.js'
import {
    createRequestListener,
    WebSocketResponder,
    WebSocketResponderError
} from './server.js'
import type {
    Message,
    Response,
    WebSocketCloseInfo,
    WebSocketData,
    WebSocketIterator,
    WebSocketResponse
} from './types.js'
import { WEBSOCKET_GUID } from './constants.js'


const testEncoder = new TextEncoder()
const testResponse = {
    status: 418,
    headers: {
        'test-header': 'test header value',
        'test-header-2': 'test header value 2'
    }
} as const


function webSocketAccept(key: string): string {
    return createHash('sha1')
        .update(key + WEBSOCKET_GUID)
        .digest('base64')
}


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
        let sendSpy: jest.SpyInstance

        beforeAll(done => {
            server.listen(0, '127.0.0.1', done)
        })
        beforeEach(() => {
            sendSpy = jest.spyOn(WebSocket.prototype, 'send')
        })
        afterEach(() => {
            server.removeAllListeners('request')
            sendSpy.mockRestore()
        })
        afterAll(done => {
            server.close(done)
        })

        function connectWebSocket(
            protocol?: string,
            options?: WebSocket.ClientOptions
        ): WebSocket {
            const addressInfo = server.address()
            if (addressInfo === null || typeof addressInfo !== 'object') {
                throw new Error(`Invalid server address: ${addressInfo}`)
            }
            const uri = `ws://${addressInfo.address}:${addressInfo.port}`
            return new WebSocket(uri, protocol, options)
        }

        function webSocketAcceptFromMessage(message: Message): string {
            return webSocketAccept(message.headers['sec-websocket-key']!)
        }

        function createMultiResolver(resolve: () => void, count = 2): () => void {
            let calls = 0
            return () => {
                if (++calls >= count) {
                    resolve()
                }
            }
        }

        test('onOpen/onMessage/onClose called, messages sent and received', async () => {
            expect.assertions(9)

            const messages: WebSocketData[] = []
            let uuid: string | undefined
            let state: WebSocketResponse | undefined

            const onOpen = jest.fn<WebSocketIterator, [ string ]>(function * (u) {
                uuid = u
                yield 'server open'
                yield 'server open 2'
            })
            const onClose = jest.fn<void, [ Result<WebSocketCloseInfo, Error>, string ]>()
            const onMessage = jest.fn<WebSocketIterator, [ WebSocketData, string ]>(function * (message) {
                yield 'server message'
                yield `server echo: ${message}`
            })

            const cleanup = jest.fn()

            await new Promise<void>(resolve => {
                // Simply listening for the client close event is not enough,
                // as the server request listener has not yet returned at that
                // point. We get around this by both listening for the client
                // close event and using the messageHandler's cleanup callback.
                const waitForBothServerAndClient = createMultiResolver(resolve)

                const [ listener ] = createRequestListener(message => {
                    state = {
                        accept: webSocketAcceptFromMessage(message),
                        onOpen,
                        onMessage,
                        onClose
                    }
                    return response(
                        state,
                        cleanup.mockImplementationOnce(waitForBothServerAndClient)
                    )
                })
                server.on('request', listener)

                const client = connectWebSocket()
                client.on('open', () => client.send('client open'))
                client.on('message', message => {
                    messages.push(message)
                    if (messages.length >= 4) {
                        client.close(4321, 'client close')
                    }
                })
                client.on('close', waitForBothServerAndClient)
            })

            expect(uuid).not.toBeUndefined()
            expect(state).not.toBeUndefined()
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
            expect(onClose.mock.calls).toEqual([
                [ ok({ code: 4321, reason: 'client close' }), uuid ]
            ])
            expect(cleanup.mock.calls).toEqual([ [ state ] ])
        })

        test.each<WebSocketCloseInfo>([
            { code: 4321 },
            { code: 4321, reason: 'server close' }
        ])('returning close info from onOpen closes socket', closeInfo => {
            expect.assertions(2)

            return new Promise<void>(resolve => {
                const waitForBothServerAndClient = createMultiResolver(resolve)

                const [ listener ] = createRequestListener(message =>
                    response(
                        {
                            accept: webSocketAcceptFromMessage(message),
                            onOpen: function * () {
                                return closeInfo
                            }
                        },
                        waitForBothServerAndClient
                    )
                )
                server.on('request', listener)

                const client = connectWebSocket()
                client.on('close', (code, reason) => {
                    expect(code).toBe(closeInfo.code)
                    expect(reason).toBe(closeInfo.reason ?? '')
                    waitForBothServerAndClient()
                })
            })
        })

        test.each<WebSocketCloseInfo>([
            { code: 4321 },
            { code: 4321, reason: 'server close' }
        ])('returning close info from onMessage closes socket', async closeInfo => {
            expect.assertions(3)

            const messages: WebSocketData[] = []

            await new Promise<void>(resolve => {
                const waitForBothServerAndClient = createMultiResolver(resolve)

                const [ listener ] = createRequestListener(message =>
                    response(
                        {
                            accept: webSocketAcceptFromMessage(message),
                            onMessage: function * (message) {
                                messages.push(message)
                                return closeInfo
                            }
                        },
                        waitForBothServerAndClient
                    )
                )
                server.on('request', listener)

                const client = connectWebSocket()
                client.on('open', () => client.send('client open'))
                client.on('close', (code, reason) => {
                    expect(code).toBe(closeInfo.code)
                    expect(reason).toBe(closeInfo.reason ?? '')
                    waitForBothServerAndClient()
                })
            })

            expect(messages).toEqual([ 'client open' ])
        })

        test('stops sending messages if socket closes during generator', async () => {
            expect.assertions(2)

            const messages: WebSocketData[] = []
            const onClose = jest.fn<void, [ Result<WebSocketCloseInfo, Error>, string ]>()

            await new Promise<void>(resolve => {
                const waitForBothServerAndClient = createMultiResolver(resolve)

                const [ listener ] = createRequestListener(message =>
                    response(
                        {
                            accept: webSocketAcceptFromMessage(message),
                            onOpen: async function * () {
                                yield 'server open'
                                await setTimeout(5)
                                yield 'should be unreachable'
                            },
                            onClose
                        },
                        waitForBothServerAndClient
                    )
                )
                server.on('request', listener)

                const client = connectWebSocket()
                client.on('message', message => {
                    messages.push(message)
                    client.close(4321, 'client close')
                })
                client.on('close', waitForBothServerAndClient)
            })

            expect(messages).toEqual([ 'server open' ])
            expect(onClose.mock.calls).toEqual([
                [ ok({ code: 4321, reason: 'client close' }), expect.any(String) ]
            ])
        })

        test('onSendError called on unknown send error', async () => {
            expect.assertions(4)

            const onSendError = jest.fn<void, [ WebSocketData, Error, string ]>(() => {})
            const onMessage = jest.fn<void, [ string ]>()
            const exception = new Error('test')
            // The wrong overload is inferred so the second
            // parameter must be typed as any
            sendSpy.mockImplementation((_, callback: any) => callback(exception))

            let uuid: string | undefined

            await new Promise<void>(resolve => {
                const waitForBothServerAndClient = createMultiResolver(resolve)

                const [ listener ] = createRequestListener(message =>
                    response(
                        {
                            accept: webSocketAcceptFromMessage(message),
                            onOpen: async function * (u) {
                                uuid = u
                                yield 'a'
                                yield 'b'
                                yield 'c'
                                return { code: 1000 }
                            },
                            onSendError
                        },
                        waitForBothServerAndClient
                    )
                )
                server.on('request', listener)

                const client = connectWebSocket()
                client.on('message', onMessage)
                client.on('close', waitForBothServerAndClient)
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

        test('incoming message larger than maximumMessageSize calls exception listener and closes socket', async () => {
            expect.assertions(7)

            const onClose = jest.fn()
            const onMessage = jest.fn()
            const exceptionListener = jest.fn()

            const maximumMessageSize = 10
            let state: WebSocketResponse | undefined

            await new Promise<void>(resolve => {
                const waitForBothServerAndClient = createMultiResolver(resolve)

                const [ listener ] = createRequestListener(
                    message => {
                        state = {
                            accept: webSocketAcceptFromMessage(message),
                            onClose,
                            onMessage,
                            maximumMessageSize
                        }
                        return response(
                            state,
                            waitForBothServerAndClient
                        )
                    },
                    exceptionListener
                )
                server.on('request', listener)

                const client = connectWebSocket()
                client.on('open', () => {
                    const largeMessage = 'a'.repeat(maximumMessageSize + 1)
                    client.send(largeMessage)
                })
                client.on('close', (code, reason) => {
                    expect(code).toBe(1009)
                    expect(reason).toBe('')
                    waitForBothServerAndClient()
                })
            })

            expect(state).not.toBeUndefined()
            expect(onMessage).not.toHaveBeenCalled()
            expect(exceptionListener.mock.calls).toEqual([
                [ expect.any(RangeError), expect.any(IncomingMessage), state ]
            ])
            expect(exceptionListener).toHaveBeenCalledBefore(onClose)
            expect(onClose.mock.calls).toEqual([
                [ error(expect.any(RangeError)), expect.any(String) ]
            ])
        })

        test('outgoing message larger than maximumMessageSize calls onSendError', async () => {
            expect.assertions(2)

            const onSendError = jest.fn()

            const maximumMessageSize = 10
            const largeMessage = 'b'.repeat(maximumMessageSize + 1)
            const messages: WebSocketData[] = []

            await new Promise<void>(resolve => {
                const waitForBothServerAndClient = createMultiResolver(resolve)

                const [ listener ] = createRequestListener(message =>
                    response(
                        {
                            accept: webSocketAcceptFromMessage(message),
                            onOpen: function * () {
                                yield 'a'
                                yield largeMessage
                                yield 'c'
                                return { code: 1000 }
                            },
                            onSendError,
                            maximumMessageSize
                        },
                        waitForBothServerAndClient
                    )
                )
                server.on('request', listener)

                const client = connectWebSocket()
                client.on('message', message => messages.push(message))
                client.on('close', waitForBothServerAndClient)
            })

            expect(messages).toEqual([ 'a', 'c' ])
            expect(onSendError.mock.calls).toEqual([
                [ largeMessage, expect.any(RangeError), expect.any(String) ]
            ])
        })

        test('subprotocol sets Sec-WebSocket-Protocol header', () => {
            expect.assertions(1)

            const protocol = 'test-protocol'

            return new Promise<void>(resolve => {
                const [ listener ] = createRequestListener(message =>
                    response({
                        accept: webSocketAcceptFromMessage(message),
                        onOpen: function * () {
                            return { code: 1000 }
                        },
                        protocol
                    })
                )
                server.on('request', listener)

                const client = connectWebSocket(protocol)
                client.on('upgrade', message => {
                    expect(message.headers).toContainEntry([
                        'sec-websocket-protocol', protocol
                    ])
                })
                client.on('close', resolve)
            })
        })

        test('writes custom headers', () => {
            expect.assertions(1)

            const testHeaders = {
                'X-Test-Header': 'test',
                'X-Test-Header-2': 'test 2'
            }

            return new Promise<void>(resolve => {
                const [ listener ] = createRequestListener(message =>
                    response({
                        accept: webSocketAcceptFromMessage(message),
                        onOpen: function * () {
                            return { code: 1000 }
                        },
                        headers: testHeaders
                    })
                )
                server.on('request', listener)

                const client = connectWebSocket()
                client.on('upgrade', message => {
                    expect(message.headers).toContainEntries(
                        Object.entries(testHeaders)
                            .map(([ key, value ]) => [ key.toLowerCase(), value ])
                    )
                })
                client.on('close', resolve)
            })
        })

        test('custom uuid is passed to callbacks', () => {
            expect.assertions(1)

            const testUUID = 'test uuid'

            return new Promise<void>(resolve => {
                const [ listener ] = createRequestListener(message =>
                    response({
                        accept: webSocketAcceptFromMessage(message),
                        onOpen: function * (uuid) {
                            expect(uuid).toBe(testUUID)
                            return { code: 1000 }
                        },
                        uuid: testUUID
                    })
                )
                server.on('request', listener)

                const client = connectWebSocket()
                client.on('close', resolve)
            })
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


describe('WebSocketResponder', () => {
    describe('fromHeaders', () => {
        test.each([
            undefined,
            'get',
            'test',
            'POST',
            'PUT',
            'DELETE',
            'PATCH',
        ])('returns NonGETMethod when method parameter not GET', method => {
            const result = WebSocketResponder.fromHeaders(method, {})
            expect(result).toEqual(
                error<WebSocketResponderError>({ tag: 'NonGETMethod', method })
            )
        })

        test('returns MissingUpgradeHeader when upgrade header missing', () => {
            const result = WebSocketResponder.fromHeaders('GET', {})
            expect(result).toEqual(
                error<WebSocketResponderError>({ tag: 'MissingUpgradeHeader' })
            )
        })

        test.each([
            ' websocket',
            'websocket ',
            'test'
        ])('returns InvalidUpgradeHeader when upgrade header not websocket', header => {
            const result = WebSocketResponder.fromHeaders('GET', { upgrade: header })
            expect(result).toEqual(
                error<WebSocketResponderError>({
                    tag: 'InvalidUpgradeHeader',
                    header
                })
            )
        })

        test('returns MissingKeyHeader when sec-websocket-key header missing', () => {
            const result = WebSocketResponder.fromHeaders('GET', { upgrade: 'websocket' })
            expect(result).toEqual(
                error<WebSocketResponderError>({ tag: 'MissingKeyHeader' })
            )
        })

        test.each([
            'a'.repeat(21) + '==',
            'a'.repeat(23) + '==',
            'a'.repeat(24),
            '-'.repeat(22) + '==',
            '='.repeat(24),
            ' '.repeat(22) + '==',
        ])('returns InvalidKeyHeader when sec-websocket-key header invalid', header => {
            const result = WebSocketResponder.fromHeaders('GET', {
                upgrade: 'websocket',
                'sec-websocket-key': header
            })
            expect(result).toEqual(
                error<WebSocketResponderError>({
                    tag: 'InvalidKeyHeader',
                    header
                })
            )
        })

        test('returns MissingVersionHeader when sec-websocket-version header missing', () => {
            const result = WebSocketResponder.fromHeaders('GET', {
                upgrade: 'websocket',
                'sec-websocket-key': 'a'.repeat(22) + '=='
            })
            expect(result).toEqual(
                error<WebSocketResponderError>({ tag: 'MissingVersionHeader' })
            )
        })

        test.each([
            '7',
            '9',
            '12',
            '14',
            'test'
        ])('returns InvalidOrUnsupportedVersionHeader when sec-websocket-version header not 8 or 13', header => {
            const result = WebSocketResponder.fromHeaders('GET', {
                upgrade: 'websocket',
                'sec-websocket-key': 'a'.repeat(22) + '==',
                'sec-websocket-version': header
            })
            expect(result).toEqual(
                error<WebSocketResponderError>({
                    tag: 'InvalidOrUnsupportedVersionHeader',
                    header
                })
            )
        })

        test('returns responder with correct accept and protocol', () => {
            const key = 'a'.repeat(22) + '=='
            const protocol = 'test protocol'
            const result = WebSocketResponder.fromHeaders('GET', {
                upgrade: 'websocket',
                'sec-websocket-key': key,
                'sec-websocket-protocol': protocol,
                'sec-websocket-version': '13'
            })

            expect(result.ok).toBeTrue()
            expect((result.value as WebSocketResponder).accept).toBe(webSocketAccept(key))
            expect((result.value as WebSocketResponder).protocol).toBe(protocol)
        })
    })

    describe('response', () => {
        test('returns response with given options, base headers and protocol', () => {
            const key = 'a'.repeat(22) + '=='
            const protocol = 'test protocol'
            const result = WebSocketResponder.fromHeaders('GET', {
                upgrade: 'websocket',
                'sec-websocket-key': key,
                'sec-websocket-protocol': protocol,
                'sec-websocket-version': '13'
            })
            const responder = result.value as WebSocketResponder

            const onOpen = jest.fn()
            const onMessage = jest.fn()
            const onClose = jest.fn()
            const onSendError = jest.fn()
            const maximumMessageSize = 1234
            const uuid = randomUUID()
            const headers = { 'X-Test-Header': 'test' }
            const cleanup = jest.fn()
            const response = responder.response(
                {
                    onOpen,
                    onMessage,
                    onClose,
                    onSendError,
                    maximumMessageSize,
                    uuid,
                    headers
                },
                cleanup
            )

            expect(response).toEqual<typeof response>({
                state: {
                    onOpen,
                    onMessage,
                    onClose,
                    onSendError,
                    maximumMessageSize,
                    uuid,
                    headers,
                    accept: webSocketAccept(key),
                    protocol
                },
                cleanup
            })
        })
    })
})
