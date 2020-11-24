import { Ok, ok } from 'fallible'
import { IncomingMessage, ServerResponse } from 'http'

import {
    createRequestListener,
    defaultErrorHandler,
    defaultResponseHandler
} from '../src/server'
import { MessageHandler, Response } from '../src/types'


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

    test('messageHandler and responseHandler called', async () => {
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

    test('cleanup called if returned by messageHandler', async () => {
        const incomingMessageMock: IncomingMessage = { message: 'test' } as any
        const serverResponseMock: ServerResponse = new ServerResponseMock() as any

        const state = { state: 'test' }

        const cleanupMock = jest.fn<Ok<void>, [ Response | undefined ]>()

        type MessageHandlerMock = MessageHandler<{}, typeof state, void>
        const messageHandlerMock = jest.fn<ReturnType<MessageHandlerMock>, Parameters<MessageHandlerMock>>(
            () => ok({
                state,
                cleanup: cleanupMock
            })
        )

        const response: Response = { body: 'test' }
        const responseHandlerMock = jest.fn(() => ok(response))

        const listener = createRequestListener({
            messageHandler: messageHandlerMock,
            responseHandler: responseHandlerMock
        })
        await listener(incomingMessageMock, serverResponseMock)

        expect(messageHandlerMock).toHaveBeenCalledTimes(1)
        expect(messageHandlerMock).toHaveBeenCalledWith(incomingMessageMock, {})
        expect(responseHandlerMock).toHaveBeenCalledTimes(1)
        expect(responseHandlerMock).toHaveBeenCalledWith(state)
        expect(cleanupMock).toHaveBeenCalledTimes(1)
        expect(cleanupMock).toHaveBeenCalledWith(response)
    })

    test.todo('default response handler used')

    test.todo('default error handler used')

    test.todo('error from messageHandler is passed to errorHandler')

    test.todo('error from responseHandler is passed to errorHandler')

    test.todo('error from cleanup is passed to errorHandler')

    test.todo('exception from any handler results in default error handler response')

    test.todo('status passed to response')

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
