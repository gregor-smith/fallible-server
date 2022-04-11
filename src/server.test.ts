import { TextEncoder } from 'node:util'
import { Readable } from 'node:stream'
import { createServer } from 'node:http'

import 'jest-extended'
import { Response as MockResponse } from 'mock-http'

import { response } from './utils.js'
import { createRequestListener } from './server.js'
import type {
    Message,
    Response
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

        test.todo('onOpen/onMessage/onClose called, messages sent and received')

        test.todo('returning close info from onOpen closes socket')

        test.todo('returning close info from onMessage closes socket')

        test.todo('stops sending messages if socket closes during message generator')

        test.todo('onSendError called on unknown send error')

        test.todo('incoming message larger than maximumMessageSize is rejected')

        test.todo('outgoing message larger than maximumMessageSize calls onSendError')

        test.todo('subprotocol sets Sec-WebSocket-Protocol header')

        test.todo('writes custom headers')

        test.todo('custom uuid is passed to callbacks')
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
        test.todo('returns NonGETMethod when method parameter not GET')

        test.todo('returns InvalidUpgradeHeader when upgrade header not websocket')

        test.todo('returns InvalidKeyHeader when sec-websocket-key header invalid')

        test.todo('returns InvalidOrUnsupportedVersionHeader when sec-websocket-version header not 8 or 13')

        test.todo('returns responder with correct accept and protocol')
    })

    describe('response', () => {
        test.todo('returns response with given options, base headers and protocol')
    })
})
