import type { IncomingMessage, ServerResponse } from 'http'
import type { Readable } from 'stream'

import { error, ok } from 'fallible'

import {
    createRequestListener,
    defaultErrorHandler,
    defaultResponseHandler
} from '../src/server'
import type { Cleanup, Cookie, MessageHandler } from '../src/types'
import { cookieHeader } from '../src/utils'


describe('defaultErrorHandler', () => {
    test('returns internal server error', () => {
        const result = defaultErrorHandler()
        expect(result).toMatchSnapshot()
    })
})


describe('defaultResponseHandler', () => {
    test('returns success', () => {
        const result = defaultResponseHandler()
        expect(result).toMatchSnapshot()
    })
})


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
    const incomingMessageMock: IncomingMessage = { tag: 'message' } as any

    const testState = { tag: 'state' } as const
    const testError = { tag: 'error' } as const

    type TestState = typeof testState
    type TestError = typeof testError

    type TestMessageHandler = MessageHandler<{}, TestState, TestError>
    type TestCleanup = Cleanup<TestError>

    function createMessageHandlerMock(
        cleanup?: TestCleanup
    ): jest.MockedFunction<TestMessageHandler> {
        return jest.fn((..._) => ok({ state: testState, cleanup }))
    }
    function createErrorMessageHandlerMock(): jest.MockedFunction<TestMessageHandler> {
        return jest.fn((..._) => error(testError))
    }

    afterEach(jest.resetAllMocks)

    test('messageHandler and responseHandler params called', async () => {
        const messageHandlerMock = createMessageHandlerMock()
        const responseHandlerMock = jest.fn(defaultResponseHandler)

        const listener = createRequestListener({
            messageHandler: messageHandlerMock,
            responseHandler: responseHandlerMock
        })
        await listener(incomingMessageMock, serverResponseMock)

        expect(messageHandlerMock).toHaveBeenCalledTimes(1)
        expect(messageHandlerMock).toHaveBeenCalledWith(incomingMessageMock, {})
        expect(responseHandlerMock).toHaveBeenCalledTimes(1)
        expect(responseHandlerMock).toHaveBeenCalledWith(testState)
    })

    test.todo('default response handler used when none given as parameter')

    test('cleanup returned by messageHandler called if responseHandler succeeds', async () => {
        const cleanupMock = jest.fn()
        const messageHandlerMock = createMessageHandlerMock(cleanupMock)
        const responseHandlerMock = jest.fn(defaultResponseHandler)

        const listener = createRequestListener({
            messageHandler: messageHandlerMock,
            responseHandler: responseHandlerMock
        })
        await listener(incomingMessageMock, serverResponseMock)

        expect(messageHandlerMock).toHaveBeenCalledTimes(1)
        expect(responseHandlerMock).toHaveBeenCalledTimes(1)
        expect(cleanupMock).toHaveBeenCalledTimes(1)
    })

    test('cleanup still called even if responseHandler fails', async () => {
        const cleanupMock = jest.fn()
        const messageHandlerMock = createMessageHandlerMock(cleanupMock)
        const responseHandlerMock = jest.fn(() => error(testError))

        const listener = createRequestListener({
            messageHandler: messageHandlerMock,
            responseHandler: responseHandlerMock
        })
        await listener(incomingMessageMock, serverResponseMock)

        expect(messageHandlerMock).toHaveBeenCalledTimes(1)
        expect(responseHandlerMock).toHaveBeenCalledTimes(1)
        expect(cleanupMock).toHaveBeenCalledTimes(1)
    })

    test('messageHandler error propagates to errorHandler', async () => {
        const messageHandlerMock = createErrorMessageHandlerMock()
        const responseHandlerMock = jest.fn(defaultResponseHandler)
        const errorHandlerMock = jest.fn(defaultErrorHandler)

        const listener = createRequestListener({
            messageHandler: messageHandlerMock,
            responseHandler: responseHandlerMock,
            errorHandler: errorHandlerMock
        })
        await listener(incomingMessageMock, serverResponseMock)

        expect(messageHandlerMock).toHaveBeenCalledTimes(1)
        expect(responseHandlerMock).not.toHaveBeenCalled()
        expect(errorHandlerMock).toHaveBeenCalledTimes(1)
        expect(errorHandlerMock).toHaveBeenCalledWith(testError)
    })

    test('responseHandler error propagates to errorHandler', async () => {
        const messageHandlerMock = createMessageHandlerMock()
        const responseHandlerMock = jest.fn(() => error(testError))
        const errorHandlerMock = jest.fn(defaultErrorHandler)

        const listener = createRequestListener({
            messageHandler: messageHandlerMock,
            responseHandler: responseHandlerMock,
            errorHandler: errorHandlerMock
        })
        await listener(incomingMessageMock, serverResponseMock)

        expect(messageHandlerMock).toHaveBeenCalledTimes(1)
        expect(responseHandlerMock).toHaveBeenCalledTimes(1)
        expect(errorHandlerMock).toHaveBeenCalledTimes(1)
        expect(errorHandlerMock).toHaveBeenCalledWith(testError)
    })

    test('cleanup error propagates to errorHandler', async () => {
        const messageHandlerMock = createMessageHandlerMock(() => error(testError))
        const responseHandlerMock = jest.fn(defaultResponseHandler)
        const errorHandlerMock = jest.fn(defaultErrorHandler)

        const listener = createRequestListener({
            messageHandler: messageHandlerMock,
            responseHandler: responseHandlerMock,
            errorHandler: errorHandlerMock
        })
        await listener(incomingMessageMock, serverResponseMock)

        expect(messageHandlerMock).toHaveBeenCalledTimes(1)
        expect(responseHandlerMock).toHaveBeenCalledTimes(1)
        expect(errorHandlerMock).toHaveBeenCalledTimes(1)
        expect(errorHandlerMock).toHaveBeenCalledWith(testError)
    })

    test.todo('default error handler used when none given as parameter')

    test('cookies, headers and status code passed to response', async () => {
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
            messageHandler: createMessageHandlerMock(),
            responseHandler: jest.fn(() =>
                ok({
                    status,
                    cookies,
                    headers
                })
            )
        })
        await listener(incomingMessageMock, serverResponseMock)

        const expectedHeaders: [ string, string ][]  = []
        for (const [ name, cookie ] of Object.entries(cookies)) {
            expectedHeaders.push([ 'Set-Cookie', cookieHeader(name, cookie) ])
        }
        for (const [ name, header ] of Object.entries(headers)) {
            expectedHeaders.push([ name, header ])
        }

        expect(serverResponseMock.setStatusCode).toHaveBeenCalledTimes(1)
        expect(serverResponseMock.setStatusCode).toHaveBeenCalledWith(status)
        expect(serverResponseMock.setHeader.mock.calls).toEqual(expectedHeaders)
    })

    describe('string response body', () => {
        const body = 'string body 🤔'

        test('content type and length not set if already present', async () => {
            serverResponseMock.hasHeader.mockImplementation(() => true)

            const listener = createRequestListener({
                messageHandler: createMessageHandlerMock(),
                responseHandler: () => ok({ body })
            })
            await listener(incomingMessageMock, serverResponseMock)

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
                messageHandler: createMessageHandlerMock(),
                responseHandler: () => ok({ body })
            })
            await listener(incomingMessageMock, serverResponseMock)

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
                messageHandler: createMessageHandlerMock(),
                responseHandler: () => ok({ body })
            })
            await listener(incomingMessageMock, serverResponseMock)

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
                messageHandler: createMessageHandlerMock(),
                responseHandler: () => ok({ body })
            })
            await listener(incomingMessageMock, serverResponseMock)

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
                messageHandler: createMessageHandlerMock(),
                responseHandler: () => ok({ body })
            })
            await listener(incomingMessageMock, serverResponseMock)

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
                messageHandler: createMessageHandlerMock(),
                responseHandler: () => ok({ body })
            })
            await listener(incomingMessageMock, serverResponseMock)

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
                messageHandler: createMessageHandlerMock(),
                responseHandler: () => ok({})
            })
            await listener(incomingMessageMock, serverResponseMock)

            expect(serverResponseMock.setHeader).not.toHaveBeenCalled()
            expect(serverResponseMock.end.mock.calls).toEqual([ [] ])
        })
    })

    test('response from errorHandler is used when error propagates', async () => {
        const body = 'test body'
        const listener = createRequestListener({
            messageHandler: createErrorMessageHandlerMock(),
            errorHandler: () => ({ body })
        })
        await listener(incomingMessageMock, serverResponseMock)

        expect(serverResponseMock.end).toHaveBeenCalledWith(body)
    })

    describe('exception from handlers results in default error handler response', () => {
        const { status, body } = defaultErrorHandler()

        test('during message handler', async () => {
            const listener = createRequestListener({
                messageHandler: () => { throw 'test' }
            })
            await listener(incomingMessageMock, serverResponseMock)

            expect(serverResponseMock.setStatusCode).toHaveBeenCalledWith(status)
            expect(serverResponseMock.end).toHaveBeenCalledWith(body)
        })

        test('during response handler', async () => {
            const listener = createRequestListener({
                messageHandler: createMessageHandlerMock(),
                responseHandler: () => { throw 'test' }
            })
            await listener(incomingMessageMock, serverResponseMock)

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
            await listener(incomingMessageMock, serverResponseMock)

            expect(serverResponseMock.setStatusCode).toHaveBeenCalledWith(status)
            expect(serverResponseMock.end).toHaveBeenCalledWith(body)
        })

        test('during error handler', async () => {
            const listener = createRequestListener({
                messageHandler: createErrorMessageHandlerMock(),
                errorHandler: () => { throw 'test' }
            })
            await listener(incomingMessageMock, serverResponseMock)

            expect(serverResponseMock.setStatusCode).toHaveBeenCalledWith(status)
            expect(serverResponseMock.end).toHaveBeenCalledWith(body)
        })
    })
})


describe('composeMessageHandlers', () => {
    test.todo('handlers called with message and each successive state')

    test.todo('cleanups of previous handlers called in reverse order and initial error returned')

    test.todo('composed error returned on previous handler cleanup error')

    test.todo('final reduced state returned')

    test.todo('no cleanup returned if no handlers had cleanup')

    test.todo('cleanup returned if at least one handler had cleanup')

    test.todo('cleanup calls handler cleanups in reverse order')

    test.todo('composed error returned on cleanup error')
})
