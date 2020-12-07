import 'jest-extended'

import type { IncomingMessage, ServerResponse } from 'http'
import type { Readable } from 'stream'

import { error, Ok, ok } from 'fallible'

import {
    composeMessageHandlers,
    createRequestListener,
    defaultErrorHandler
} from '../src/server'
import type {
    Response,
    Cleanup,
    Cookie,
    MessageHandler,
    MessageHandlerResult
} from '../src/types'
import { cookieHeader } from '../src/utils'


describe('defaultErrorHandler', () => {
    test('returns internal server error', () => {
        const result = defaultErrorHandler()
        expect(result).toMatchSnapshot()
    })
})


const dummyIncomingMessage: IncomingMessage = { tag: 'message' } as any


describe('createRequestListener', () => {
    class ServerResponseMock {
        public readonly setStatusCode = jest.fn<void, [ number ]>()
        public readonly setHeader = jest.fn<void, [ string, string ]>()
        public readonly hasHeader = jest.fn<boolean, [ string ]>()
        public readonly end = jest.fn<void, [] | [ string | Buffer ]>()

        public set statusCode(value: number) {
            this.setStatusCode(value)
        }
    }

    const serverResponseMock: ServerResponse & ServerResponseMock = new ServerResponseMock() as any

    const testResponse: Response = { body: 'test response' }
    const testError = { tag: 'error' } as const

    type TestError = typeof testError

    type TestMessageHandler = MessageHandler<void, Response, TestError>

    function createMessageHandlerMock(
        cleanup?: Cleanup<TestError>
    ): jest.MockedFunction<TestMessageHandler> {
        return jest.fn((..._) => ok({ state: testResponse, cleanup }))
    }

    afterEach(jest.resetAllMocks)

    test('messageHandler param called', async () => {
        const messageHandlerMock = createMessageHandlerMock()

        const listener = createRequestListener({
            messageHandler: messageHandlerMock
        })
        await listener(dummyIncomingMessage, serverResponseMock)

        expect(messageHandlerMock).toHaveBeenCalledTimes(1)
        expect(messageHandlerMock).toHaveBeenCalledWith(dummyIncomingMessage)
    })

    test('cleanup returned by messageHandler called succeeds', async () => {
        const cleanupMock = jest.fn()
        const messageHandlerMock = createMessageHandlerMock(cleanupMock)

        const listener = createRequestListener({
            messageHandler: messageHandlerMock
        })
        await listener(dummyIncomingMessage, serverResponseMock)

        expect(messageHandlerMock).toHaveBeenCalledTimes(1)
        expect(cleanupMock).toHaveBeenCalledTimes(1)
    })

    test('messageHandler error propagates to errorHandler', async () => {
        const messageHandlerMock: jest.MockedFunction<TestMessageHandler> = jest.fn(
            (..._) => error(testError)
        )
        const errorHandlerMock = jest.fn(defaultErrorHandler)

        const listener = createRequestListener({
            messageHandler: messageHandlerMock,
            errorHandler: errorHandlerMock
        })
        await listener(dummyIncomingMessage, serverResponseMock)

        expect(messageHandlerMock).toHaveBeenCalledTimes(1)
        expect(errorHandlerMock).toHaveBeenCalledTimes(1)
        expect(errorHandlerMock).toHaveBeenCalledWith<any>(testError)
    })

    test('cleanup error propagates to errorHandler', async () => {
        const messageHandlerMock = createMessageHandlerMock(() => error(testError))
        const errorHandlerMock = jest.fn(defaultErrorHandler)

        const listener = createRequestListener({
            messageHandler: messageHandlerMock,
            errorHandler: errorHandlerMock
        })
        await listener(dummyIncomingMessage, serverResponseMock)

        expect(messageHandlerMock).toHaveBeenCalledTimes(1)
        expect(errorHandlerMock).toHaveBeenCalledTimes(1)
        expect(errorHandlerMock).toHaveBeenCalledWith<any>(testError)
    })

    test.each<Response['body']>([
        undefined,
        'test body',
        Buffer.from('test body', 'utf-8'),
        { pipe: () => {} } as any,
        // { onMessage: () => CloseWebSocket }
    ])('cookies, headers and status code passed to response', async body => {
        expect.assertions(6)

        const cookies: Record<string, Cookie> = {
            'test-cookie': {
                value: 'test-value'
            },
            'test-cookie-2': {
                value: 'test-value-2',
                domain: 'test.domain',
                httpOnly: true,
                maxAge: 123,
                path: '/test/path',
                sameSite: 'lax',
                secure: true
            }
        }
        const headers = {
            'X-Test-Header': 'test value',
            'X-Test-Header-2': 'test value 2'
        }
        const status = 123

        const listener = createRequestListener({
            messageHandler: () => ok({
                state: {
                    body,
                    status,
                    headers,
                    cookies
                }
            })
        })
        await listener(dummyIncomingMessage, serverResponseMock)

        expect(serverResponseMock.setStatusCode).toHaveBeenCalledTimes(1)
        expect(serverResponseMock.setStatusCode).toHaveBeenCalledWith(status)

        for (const [ name, cookie ] of Object.entries(cookies)) {
            expect(serverResponseMock.setHeader).toHaveBeenCalledWith(
                'Set-Cookie',
                cookieHeader(name, cookie)
            )
        }
        for (const [ name, header ] of Object.entries(headers)) {
            expect(serverResponseMock.setHeader).toHaveBeenCalledWith(
                name,
                header
            )
        }
    })

    describe('string response body', () => {
        const body = 'string body 🤔'

        test('content type and length not set if already present', async () => {
            serverResponseMock.hasHeader.mockImplementation(() => true)

            const listener = createRequestListener({
                messageHandler: () => ok({ state: { body } })
            })
            await listener(dummyIncomingMessage, serverResponseMock)

            expect(serverResponseMock.hasHeader.mock.calls).toEqual([
                [ 'Content-Type' ],
                [ 'Content-Length' ]
            ])
            expect(serverResponseMock.setHeader).not.toHaveBeenCalled()
            expect(serverResponseMock.end.mock.calls).toEqual([ [ body ] ])
        })

        test('content type defaults to plain text, content length to body length', async () => {
            serverResponseMock.hasHeader.mockImplementation(() => false)

            const listener = createRequestListener({
                messageHandler: () => ok({ state: { body } })
            })
            await listener(dummyIncomingMessage, serverResponseMock)

            expect(serverResponseMock.hasHeader.mock.calls).toEqual([
                [ 'Content-Type' ],
                [ 'Content-Length' ]
            ])
            expect(serverResponseMock.setHeader.mock.calls).toEqual([
                [ 'Content-Type', 'text/plain; charset=utf-8' ],
                [ 'Content-Length', Buffer.byteLength(body) ],
            ])
            expect(serverResponseMock.end.mock.calls).toEqual([ [ body ] ])
        })
    })

    describe('buffer response body', () => {
        const body = Buffer.from('buffer body 🤔')

        test('content type and length not set if already present', async () => {
            serverResponseMock.hasHeader.mockImplementation(() => true)

            const listener = createRequestListener({
                messageHandler: () => ok({ state: { body } })
            })
            await listener(dummyIncomingMessage, serverResponseMock)

            expect(serverResponseMock.hasHeader.mock.calls).toEqual([
                [ 'Content-Type' ],
                [ 'Content-Length' ]
            ])
            expect(serverResponseMock.setHeader).not.toHaveBeenCalled()
            expect(serverResponseMock.end.mock.calls).toEqual([ [ body ] ])
        })

        test('content type defaults to byte stream, content length to body length', async () => {
            serverResponseMock.hasHeader.mockImplementation(() => false)

            const listener = createRequestListener({
                messageHandler: () => ok({ state: { body } })
            })
            await listener(dummyIncomingMessage, serverResponseMock)

            expect(serverResponseMock.hasHeader.mock.calls).toEqual([
                [ 'Content-Type' ],
                [ 'Content-Length' ]
            ])
            expect(serverResponseMock.setHeader.mock.calls).toEqual([
                [ 'Content-Type', 'application/octet-stream' ],
                [ 'Content-Length', body.length ],
            ])
            expect(serverResponseMock.end.mock.calls).toEqual([ [ body ] ])
        })
    })

    describe('stream response body', () => {
        const pipeMock = jest.fn<void, [ ServerResponse ]>()
        const body: Readable = { pipe: pipeMock } as any

        test('body set, content type not set if already present', async () => {
            serverResponseMock.hasHeader.mockImplementation(() => true)

            const listener = createRequestListener({
                messageHandler: () => ok({ state: { body } })
            })
            await listener(dummyIncomingMessage, serverResponseMock)

            expect(serverResponseMock.hasHeader.mock.calls).toEqual([
                [ 'Content-Type' ]
            ])
            expect(serverResponseMock.setHeader).not.toHaveBeenCalled()
            expect(pipeMock.mock.calls).toEqual([ [ serverResponseMock ] ])
            expect(serverResponseMock.end).not.toHaveBeenCalled()
        })

        test('content type defaults to byte stream', async () => {
            serverResponseMock.hasHeader.mockImplementation(() => false)

            const listener = createRequestListener({
                messageHandler: () => ok({ state: { body } })
            })
            await listener(dummyIncomingMessage, serverResponseMock)

            expect(serverResponseMock.hasHeader.mock.calls).toEqual([
                [ 'Content-Type' ]
            ])
            expect(serverResponseMock.setHeader.mock.calls).toEqual([
                [ 'Content-Type', 'application/octet-stream' ]
            ])
            expect(pipeMock.mock.calls).toEqual([ [ serverResponseMock ] ])
            expect(serverResponseMock.end).not.toHaveBeenCalled()
        })
    })

    describe('no response body', () => {
        test('response ended with no body', async () => {
            const listener = createRequestListener({
                messageHandler: () => ok({ state: {} })
            })
            await listener(dummyIncomingMessage, serverResponseMock)

            expect(serverResponseMock.setHeader).not.toHaveBeenCalled()
            expect(serverResponseMock.end.mock.calls).toEqual([ [] ])
        })
    })

    test('response from errorHandler is used when error propagates', async () => {
        const body = 'test body'
        const listener = createRequestListener({
            messageHandler: error,
            errorHandler: () => ({ body })
        })
        await listener(dummyIncomingMessage, serverResponseMock)

        expect(serverResponseMock.end).toHaveBeenCalledWith(body)
    })

    describe('exception from handlers results in default error handler response', () => {
        const { status, body } = defaultErrorHandler()

        test('during message handler', async () => {
            const listener = createRequestListener({
                messageHandler: () => { throw 'test' }
            })
            await listener(dummyIncomingMessage, serverResponseMock)

            expect(serverResponseMock.setStatusCode).toHaveBeenCalledWith(status)
            expect(serverResponseMock.end).toHaveBeenCalledWith(body)
        })

        test('during message handler cleanup', async () => {
            const listener = createRequestListener({
                messageHandler: () => ok({
                    state: {},
                    cleanup: () => { throw 'test' }
                })
            })
            await listener(dummyIncomingMessage, serverResponseMock)

            expect(serverResponseMock.setStatusCode).toHaveBeenCalledWith(status)
            expect(serverResponseMock.end).toHaveBeenCalledWith(body)
        })

        test('during error handler', async () => {
            const listener = createRequestListener({
                messageHandler: error,
                errorHandler: () => { throw 'test' }
            })
            await listener(dummyIncomingMessage, serverResponseMock)

            expect(serverResponseMock.setStatusCode).toHaveBeenCalledWith(status)
            expect(serverResponseMock.end).toHaveBeenCalledWith(body)
        })
    })

    test('default error handler used when none given as parameter', async () => {
        const listener = createRequestListener({
            messageHandler: error
        })
        await listener(dummyIncomingMessage, serverResponseMock)

        const { status, body } = defaultErrorHandler()
        expect(serverResponseMock.setStatusCode).toHaveBeenCalledWith(status)
        expect(serverResponseMock.end).toHaveBeenCalledWith(body)
    })

    // describe('websocket body', () => {
    // })
})


describe('composeMessageHandlers', () => {
    test('handlers called in order with message and each successive state', async () => {
        expect.assertions(7)

        const a: MessageHandler<void, { a: true }, void> = (message, state) => {
            expect(message).toBe(dummyIncomingMessage)
            expect(state).toBeUndefined()
            return ok({
                state: { a: true }
            })
        }

        const b: MessageHandler<{ a: true }, { b: true }, void> = (message, state) => {
            expect(message).toBe(dummyIncomingMessage)
            expect(state).toEqual({ a: true })
            return ok({
                state: { b: true }
            })
        }

        const c: MessageHandler<{ b: true }, { c: true }, void> = (message, state) => {
            expect(message).toBe(dummyIncomingMessage)
            expect(state).toEqual({ b: true })
            return ok({
                state: { c: true }
            })
        }

        const composed = composeMessageHandlers(
            [ a, b, c ],
            errors => errors[0]
        )
        const result = await composed(dummyIncomingMessage)

        expect(result).toEqual(
            ok({
                state: { c: true }
            })
        )
    })

    test('cleanup returned if at least one handler had cleanup', async () => {
        const a: MessageHandler<void, void, void> = (_, state) =>
            ok({ state })
        const b: MessageHandler<void, void, void> = (_, state) =>
            ok({ state, cleanup: ok })
        const c: MessageHandler<void, void, void> = (_, state) =>
            ok({ state })

        const composed = composeMessageHandlers(
            [ a, b, c ],
            errors => errors[0]
        )
        const result = await composed(dummyIncomingMessage)
        expect(result.ok).toBeTrue()
        const { cleanup } = result.value as MessageHandlerResult<void, void>
        expect(cleanup).not.toBeUndefined()
    })

    test('cleanup calls handler cleanups in reverse order', async () => {
        const aCleanup = jest.fn<Ok<void>, []>(ok)
        const a: MessageHandler<void, void, void> = (_, state) =>
            ok({ state, cleanup: aCleanup })

        const bCleanup = jest.fn<Ok<void>, []>(ok)
        const b: MessageHandler<void, void, void> = (_, state) =>
            ok({ state, cleanup: bCleanup })

        const c: MessageHandler<void, void, void> = (_, state) =>
            ok({ state })

        const dCleanup = jest.fn<Ok<void>, []>(ok)
        const d: MessageHandler<void, void, void> = (_, state) =>
            ok({ state, cleanup: dCleanup })

        const composed = composeMessageHandlers(
            [ a, b, c, d ],
            errors => errors[0]
        )
        const handlerResult = await composed(dummyIncomingMessage)

        expect(handlerResult.ok).toBeTrue()
        const { cleanup } = handlerResult.value as MessageHandlerResult<void, void>
        expect(cleanup).not.toBeUndefined()

        const cleanupResult = await cleanup!()
        expect(cleanupResult.ok).toBeTrue()
        expect(aCleanup).toHaveBeenCalled()
        expect(bCleanup).toHaveBeenCalled()
        expect(dCleanup).toHaveBeenCalled()
        expect(aCleanup).toHaveBeenCalledAfter(bCleanup)
        expect(bCleanup).toHaveBeenCalledAfter(dCleanup)
    })

    test('on handler error, cleanups of previous handlers called in reverse order and error returned ', async () => {
        const testError = 'test'

        const aCleanup = jest.fn<Ok<void>, []>(ok)
        const a: MessageHandler<void, void, typeof testError> = (_, state) =>
            ok({ state, cleanup: aCleanup })

        const bCleanup = jest.fn<Ok<void>, []>(ok)
        const b: MessageHandler<void, void, typeof testError> = (_, state) =>
            ok({ state, cleanup: bCleanup })

        const c: MessageHandler<void, void, typeof testError> = () => error(testError)

        const dCleanup = jest.fn()
        const d: MessageHandler<void, void, typeof testError> = (_, state) =>
            ok({ state, cleanup: dCleanup })

        const composed = composeMessageHandlers(
            [ a, b, c, d ],
            errors => errors[0]
        )
        const result = await composed(dummyIncomingMessage)

        expect(result).toEqual(error(testError))
        expect(aCleanup).toHaveBeenCalled()
        expect(bCleanup).toHaveBeenCalled()
        expect(dCleanup).not.toHaveBeenCalled()
        expect(aCleanup).toHaveBeenCalledAfter(bCleanup)
    })

    test('on cleanup error, all cleanups still called and composed cleanup error returned', async () => {
        expect.assertions(12)

        type TestError = 'AError' | 'BError' | 'DError' | 'ComposedError'

        const aCleanup = jest.fn(() => error<TestError>('AError'))
        const a: MessageHandler<void, void, TestError> = (_, state) =>
            ok({ state, cleanup: aCleanup })

        const bCleanup = jest.fn(() => error<TestError>('BError'))
        const b: MessageHandler<void, void, TestError> = (_, state) =>
            ok({ state, cleanup: bCleanup })

        const cCleanup = jest.fn<Ok<void>, []>(ok)
        const c: MessageHandler<void, void, TestError> = (_, state) =>
            ok({ state, cleanup: cCleanup })

        const dCleanup = jest.fn(() => error<TestError>('DError'))
        const d: MessageHandler<void, void, TestError> = (_, state) =>
            ok({ state, cleanup: dCleanup })

        const composed = composeMessageHandlers(
            [ a, b, c, d ],
            (errors): TestError => {
                expect(errors).toEqual([ 'DError', 'BError', 'AError' ])
                return 'ComposedError'
            }
        )

        const handlerResult = await composed(dummyIncomingMessage)
        expect(handlerResult.ok).toBeTrue()
        const { cleanup } = handlerResult.value as MessageHandlerResult<void, TestError>
        expect(cleanup).not.toBeUndefined()

        const cleanupResult = await cleanup!()
        expect(cleanupResult.ok).toBeFalse()
        expect(cleanupResult.value).toBe<TestError>('ComposedError')
        expect(aCleanup).toHaveBeenCalled()
        expect(bCleanup).toHaveBeenCalled()
        expect(cCleanup).toHaveBeenCalled()
        expect(dCleanup).toHaveBeenCalled()
        expect(aCleanup).toHaveBeenCalledAfter(bCleanup)
        expect(bCleanup).toHaveBeenCalledAfter(cCleanup)
        expect(cCleanup).toHaveBeenCalledAfter(dCleanup)
    })

    test('on handler error and cleanup error, all cleanups called and composed cleanup error returned', async () => {
        expect.assertions(7)

        type TestError = 'AError' | 'CError' | 'DError' | 'ComposedError'

        const aCleanup = jest.fn(() => error<TestError>('AError'))
        const a: MessageHandler<void, void, TestError> = (_, state) =>
            ok({ state, cleanup: aCleanup })

        const bCleanup = jest.fn<Ok<void>, []>(ok)
        const b: MessageHandler<void, void, TestError> = (_, state) =>
            ok({ state, cleanup: bCleanup })

        const cCleanup = jest.fn(() => error<TestError>('CError'))
        const c: MessageHandler<void, void, TestError> = (_, state) =>
            ok({ state, cleanup: cCleanup })

        const d: MessageHandler<void, void, TestError> = () => error('DError')

        const composed = composeMessageHandlers(
            [ a, b, c, d ],
            (errors): TestError => {
                expect(errors).toEqual([ 'CError', 'AError' ])
                return 'ComposedError'
            }
        )

        const handlerResult = await composed(dummyIncomingMessage)
        expect(handlerResult).toEqual(error<TestError>('ComposedError'))
        expect(aCleanup).toHaveBeenCalled()
        expect(bCleanup).toHaveBeenCalled()
        expect(cCleanup).toHaveBeenCalled()
        expect(aCleanup).toHaveBeenCalledAfter(bCleanup)
        expect(bCleanup).toHaveBeenCalledAfter(cCleanup)
    })
})
