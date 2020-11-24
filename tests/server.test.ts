import { error, Ok, ok } from 'fallible'
import { IncomingMessage, ServerResponse } from 'http'

import {
    createRequestListener,
    defaultErrorHandler,
    defaultResponseHandler
} from '../src/server'
import { MessageHandler } from '../src/types'


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
        public readonly hasHeader = jest.fn<void, [ string ]>()
        public readonly end = jest.fn<void, [] | [ string | Buffer ]>()

        public set statusCode(value: number) {
            this.setStatusCode(value)
        }
    }

    test('messageHandler and responseHandler params called', async () => {
        const incomingMessageMock: IncomingMessage = { message: 'test' } as any
        const serverResponseMock: ServerResponse = new ServerResponseMock() as any

        const state = { state: 'test' }

        type MessageHandlerMock = MessageHandler<{}, typeof state, void>
        const messageHandlerMock = jest.fn<ReturnType<MessageHandlerMock>, Parameters<MessageHandlerMock>>(
            () => ok({ state })
        )
        const responseHandlerMock = jest.fn(defaultResponseHandler)

        const listener = createRequestListener({
            messageHandler: messageHandlerMock,
            responseHandler: responseHandlerMock
        })
        await listener(incomingMessageMock, serverResponseMock)

        expect(messageHandlerMock).toHaveBeenCalledTimes(1)
        expect(messageHandlerMock).toHaveBeenCalledWith(incomingMessageMock, {})
        expect(responseHandlerMock).toHaveBeenCalledTimes(1)
        expect(responseHandlerMock).toHaveBeenCalledWith(state)
    })

    test('cleanup returned by messageHandler called if responseHandler succeeds', async () => {
        const incomingMessageMock: IncomingMessage = { message: 'test' } as any
        const serverResponseMock: ServerResponse = new ServerResponseMock() as any

        const state = { state: 'test' }

        const cleanupMock = jest.fn<Ok<void>, []>()

        type MessageHandlerMock = MessageHandler<{}, typeof state, void>
        const messageHandlerMock = jest.fn<ReturnType<MessageHandlerMock>, Parameters<MessageHandlerMock>>(
            () => ok({
                state,
                cleanup: cleanupMock
            })
        )
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
        const incomingMessageMock: IncomingMessage = { message: 'test' } as any
        const serverResponseMock: ServerResponse = new ServerResponseMock() as any

        const state = { state: 'test' }
        const err = { error: 'test' }

        const cleanupMock = jest.fn<Ok<void>, []>()

        type MessageHandlerMock = MessageHandler<{}, typeof state, typeof err>
        const messageHandlerMock = jest.fn<ReturnType<MessageHandlerMock>, Parameters<MessageHandlerMock>>(
            () => ok({
                state,
                cleanup: cleanupMock
            })
        )
        const responseHandlerMock = jest.fn(() => error(err))

        const listener = createRequestListener({
            messageHandler: messageHandlerMock,
            responseHandler: responseHandlerMock
        })
        await listener(incomingMessageMock, serverResponseMock)

        expect(messageHandlerMock).toHaveBeenCalledTimes(1)
        expect(responseHandlerMock).toHaveBeenCalledTimes(1)
        expect(cleanupMock).toHaveBeenCalledTimes(1)
    })

    test.todo('default response handler used')

    test.todo('default error handler used')

    test('messageHandler error propagates to errorHandler', async () => {
        const incomingMessageMock: IncomingMessage = { message: 'test' } as any
        const serverResponseMock: ServerResponse = new ServerResponseMock() as any

        const err = { error: 'test' }

        type MessageHandlerMock = MessageHandler<{}, unknown, typeof err>
        const messageHandlerMock = jest.fn<ReturnType<MessageHandlerMock>, Parameters<MessageHandlerMock>>(
            () => error(err)
        )
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
        expect(errorHandlerMock).toHaveBeenCalledWith(err)
    })

    test.todo('responseHandler error propagates to errorHandler')

    test.todo('cleanup error propagates to errorHandler')

    test.todo('exception from any handler calls exceptionHandler')

    test.todo('response from responseHandler is used when all handlers succeed')

    test.todo('response from errorHandler is used when error propagates')

    test.todo('response from exceptionHandler is used if all else fails')

    test.todo('status defaults to 200')

    test.todo('cookies passed to response as headers')

    test.todo('headers passed to response')

    describe('string response body', () => {
        test.todo('content type not set if already present')

        test.todo('content type defaults to plain text')

        test.todo('content length not set if already present')

        test.todo('content length defaults to byte length of body')

        test.todo('body passed to response')
    })

    describe('buffer response body', () => {
        test.todo('content type not set if already present')

        test.todo('content type defaults to bytes')

        test.todo('content length not set if already present')

        test.todo('content length defaults to length of body')

        test.todo('body passed to response')
    })

    describe('stream response body', () => {
        test.todo('content type not set if already present')

        test.todo('content type defaults to bytes')

        test.todo('content length not set unless done so already')

        test.todo('body piped to response')
    })

    describe('no response body', () => {
        test.todo('response ended with no body')
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
