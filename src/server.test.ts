import { TextEncoder } from 'node:util'
import { Readable } from 'node:stream'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'

import 'jest-extended'
import { Response as MockResponse } from 'mock-http'
import { error } from 'fallible'
import WebSocket from 'ws'
import { Headers } from 'headers-polyfill'

import { response } from './utils.js'
import {
    createRequestListener,
    parseWebSocketHeaders,
    ParseWebSocketHeadersError
} from './server.js'
import type {
    Message,
    Response,
    WebSocketData,
    WebSocketResponse
} from './types.js'
import { WEBSOCKET_GUID } from './constants.js'


jest.setTimeout(1000)


const testEncoder = new TextEncoder()
const testResponse = {
    status: 418,
    headers: new Headers({
        'test-header': 'test header value',
        'test-header-2': 'test header value 2'
    })
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
                [ ...testResponse.headers.entries() ]
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
                [ ...testResponse.headers.entries() ]
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
        test.each([ undefined, null ])('writes default status, content type, content length', async body => {
            expect.assertions(5)

            const cleanup = jest.fn()
            const state: Response = { body }
            const [ listener ] = createRequestListener(() => response(state, cleanup))
            const res = new MockResponse()
            await listener(res.req, res)

            expect(res._internal.ended).toBeTrue()
            expect(res.statusCode).toBe(200)
            expect(res._internal.buffer).toBeEmpty()
            expect(res._internal.headers).toContainEntry([ 'content-length', 0 ])
            expect(cleanup.mock.calls).toEqual([ [ state ] ])
        })

        test.each([ undefined, null ])('writes custom status, headers', async body => {
            expect.assertions(2)

            const [ listener ] = createRequestListener(() => 
                response({ ...testResponse, body })
            )
            const res = new MockResponse()
            await listener(res.req, res)

            expect(res.statusCode).toBe(testResponse.status)
            expect(res._internal.headers).toContainEntries(
                [ ...testResponse.headers.entries() ]
            )
        })

        test.each([ undefined, null ])('exceptionListener called when response errors', async body => {
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

        function getBodies() {
            return [
                ...generators,
                ...generators.map(generator => generator()),
                ...generators.map(generator => Readable.from(generator(), { objectMode: false })),
                ...generators.map(generator => {
                    const stream = Readable.from(generator(), { objectMode: false })
                    return (Readable as any).toWeb(stream, { objectMode: false })
                })
            ]
        }

        test.each(getBodies())('writes default status, content length', async body => {
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

        test.each(getBodies())('writes custom status, headers', async body => {
            expect.assertions(2)

            const [ listener ] = createRequestListener(() =>
                response({ ...testResponse, body })
            )
            const res = new MockResponse()
            await listener(res.req, res)

            expect(res.statusCode).toBe(testResponse.status)
            expect(res._internal.headers).toContainEntries(
                [ ...testResponse.headers.entries() ]
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
        function getErrorBodies() {
            return [
                ...errorGenerators,
                ...errorGenerators.map(generator => generator()),
                ...errorGenerators.map(generator => Readable.from(generator(), { objectMode: false })),
                ...errorGenerators.map(generator => {
                    const stream = Readable.from(generator(), { objectMode: false })
                    return (Readable as any).toWeb(stream, { objectMode: false })
                })
            ]
        }

        test.each(getErrorBodies())('exceptionListener called when stream errors', async body => {
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

        test('callback called, messages sent and received', async () => {
            expect.assertions(7)

            let state: WebSocketResponse | undefined
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
                        callback: (_uuid, socket) => {
                            expect(socket.readyState).toBe(WebSocket.OPEN)
                            return new Promise<void>((resolve, reject) => {
                                const messages: WebSocketData[] = []
                                socket.on('message', message => {
                                    messages.push(message)
                                    socket.send('server message')
                                    socket.send(`server echo: ${message}`)
                                })
                                socket.on('close', (code, reason) => {
                                    expect(code).toBe(4321)
                                    expect(reason).toBe('client close')
                                    expect(messages).toEqual([ 'client open' ])
                                    resolve()
                                })
                                socket.on('error', reject)
                                socket.send('server open')
                                socket.send('server open 2')
                            })
                        }
                    }
                    return response(
                        state,
                        cleanup.mockImplementationOnce(waitForBothServerAndClient)
                    )
                }) 
                server.on('request', listener)

                const messages: WebSocketData[] = []
                const client = connectWebSocket()
                client.on('open', () => client.send('client open'))
                client.on('message', message => {
                    messages.push(message)
                    if (messages.length >= 4) {
                        client.close(4321, 'client close')
                    }
                })
                client.on('close', () => {
                    expect(messages).toEqual([
                        'server open',
                        'server open 2',
                        'server message',
                        'server echo: client open'
                    ])
                    waitForBothServerAndClient()
                })
            })

            expect(state).not.toBeUndefined()
            expect(cleanup.mock.calls).toEqual([ [ state ] ])
        })

        test('incoming message larger than maximumIncomingMessageSize fires error event and closes socket', () => {
            expect.assertions(6)

            return new Promise<void>(resolve => {
                const waitForBothServerAndClient = createMultiResolver(resolve)

                const maximumIncomingMessageSize = 10
                const [ listener ] = createRequestListener(message =>
                    response<WebSocketResponse>(
                        {
                            accept: webSocketAcceptFromMessage(message),
                            callback: (_uuid, socket) =>
                                new Promise<void>(resolve => {
                                    const messages: WebSocketData[] = []
                                    socket.on('message', message => {
                                        messages.push(message)
                                    })
                                    socket.on('close', (code, reason) => {
                                        expect(code).toBe(1009)
                                        expect(reason).toBe('')
                                        expect(messages).toEqual([ 'a' ])
                                        resolve()
                                    })
                                    socket.on('error', error => {
                                        expect(error).toBeInstanceOf(RangeError)
                                    })
                                }),
                            maximumIncomingMessageSize
                        },
                        waitForBothServerAndClient
                    )
                )
                server.on('request', listener)

                const client = connectWebSocket()
                client.on('open', () => {
                    client.send('a')
                    client.send('b'.repeat(maximumIncomingMessageSize + 1))
                    client.send('c')
                })
                client.on('close', (code, reason) => {
                    expect(code).toBe(1009)
                    expect(reason).toBe('')
                    waitForBothServerAndClient()
                })
            })
        })

        test('subprotocol sets Sec-WebSocket-Protocol header', () => {
            expect.assertions(1)

            return new Promise<void>(resolve => {
                const protocol = 'test-protocol'

                const [ listener ] = createRequestListener(message =>
                    response<WebSocketResponse>({
                        accept: webSocketAcceptFromMessage(message),
                        callback: (_uuid, socket) =>
                            new Promise<void>(resolve => {
                                socket.on('close', () => resolve())
                                socket.close()
                            }),
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

            return new Promise<void>(resolve => {
                const [ listener ] = createRequestListener(message =>
                    response<WebSocketResponse>({
                        accept: webSocketAcceptFromMessage(message),
                        callback: (_uuid, socket) =>
                            new Promise<void>(resolve => {
                                socket.on('close', () => resolve())
                                socket.close()
                            }),
                        headers: testResponse.headers
                    })
                )
                server.on('request', listener)

                const client = connectWebSocket()
                client.on('upgrade', message => {
                    expect(message.headers).toContainEntries(
                        [ ...testResponse.headers.entries() ]
                    )
                })
                client.on('close', resolve)
            })
        })

        test('custom uuid is passed to callbacks', () => {
            expect.assertions(1)

            return new Promise<void>(resolve => {
                const testUUID = 'test uuid'

                const [ listener ] = createRequestListener(message =>
                    response<WebSocketResponse>({
                        accept: webSocketAcceptFromMessage(message),
                        callback: (uuid, socket) => {
                            expect(uuid).toBe(testUUID)
                            return new Promise<void>(resolve => {
                                socket.on('close', () => resolve())
                                socket.close()
                            })
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


describe('parseWebSocketHeaders', () => {
    describe('fromHeaders', () => {
        test('returns MissingUpgradeHeader when upgrade header missing', () => {
            const result = parseWebSocketHeaders({})
            expect(result).toEqual(
                error<ParseWebSocketHeadersError>({ tag: 'MissingUpgradeHeader' })
            )
        })

        test.each([
            ' websocket',
            'websocket ',
            'test'
        ])('returns InvalidUpgradeHeader when upgrade header not websocket', header => {
            const result = parseWebSocketHeaders({ upgrade: header })
            expect(result).toEqual(
                error<ParseWebSocketHeadersError>({
                    tag: 'InvalidUpgradeHeader',
                    header
                })
            )
        })

        test('returns MissingKeyHeader when sec-websocket-key header missing', () => {
            const result = parseWebSocketHeaders({ upgrade: 'websocket' })
            expect(result).toEqual(
                error<ParseWebSocketHeadersError>({ tag: 'MissingKeyHeader' })
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
            const result = parseWebSocketHeaders({
                upgrade: 'websocket',
                'sec-websocket-key': header
            })
            expect(result).toEqual(
                error<ParseWebSocketHeadersError>({
                    tag: 'InvalidKeyHeader',
                    header
                })
            )
        })

        test('returns MissingVersionHeader when sec-websocket-version header missing', () => {
            const result = parseWebSocketHeaders({
                upgrade: 'websocket',
                'sec-websocket-key': 'a'.repeat(22) + '=='
            })
            expect(result).toEqual(
                error<ParseWebSocketHeadersError>({ tag: 'MissingVersionHeader' })
            )
        })

        test.each([
            '7',
            '9',
            '12',
            '14',
            'test'
        ])('returns InvalidOrUnsupportedVersionHeader when sec-websocket-version header not 8 or 13', header => {
            const result = parseWebSocketHeaders({
                upgrade: 'websocket',
                'sec-websocket-key': 'a'.repeat(22) + '==',
                'sec-websocket-version': header
            })
            expect(result).toEqual(
                error<ParseWebSocketHeadersError>({
                    tag: 'InvalidOrUnsupportedVersionHeader',
                    header
                })
            )
        })

        test('returns correct accept and protocol', () => {
            const key = 'a'.repeat(22) + '=='
            const protocol = 'test protocol'
            const result = parseWebSocketHeaders({
                upgrade: 'websocket',
                'sec-websocket-key': key,
                'sec-websocket-protocol': protocol,
                'sec-websocket-version': '13'
            })

            expect(result.ok).toBeTrue()
            expect(result.value).toEqual({
                protocol,
                accept: webSocketAccept(key)
            })
        })
    })
})
