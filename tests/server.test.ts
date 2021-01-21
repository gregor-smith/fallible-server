import 'jest-extended'

import { createServer } from 'http'

import { error, ok, Ok } from 'fallible'
import { Request as MockRequest, Response as MockResponse } from 'mock-http'
import Websocket, { Data } from 'ws'

import {
    composeMessageHandlers,
    createRequestListener,
    CreateRequestListenerArguments
} from '../src/server'
import type {
    MessageHandler,
    MessageHandlerResult,
    Response,
    WebsocketGenerator
} from '../src/types'
import { CloseWebSocket, cookieHeader } from '../src/general-utils'


describe('createRequestListener', () => {
    async function mockRequest<Error>(
        args: CreateRequestListenerArguments<Error>
    ): Promise<MockResponse> {
        const listener = createRequestListener(args)
        const response = new MockResponse()
        await listener(new MockRequest(), response)
        return response
    }

    test('messageHandler param called', async () => {
        expect.assertions(1)

        const messageHandler = jest.fn<Ok<MessageHandlerResult>, []>(() =>
            ok({ state: {} })
        )
        await mockRequest({ messageHandler })

        // no need to test if response used here because later tests for
        // the various different body types also use the messageHandler
        // param
        expect(messageHandler).toHaveBeenCalledTimes(1)
    })

    test('errorHandler called on messageHandler error and response used', async () => {
        expect.assertions(3)

        const errorMessage = 'test'
        const body = 'test body'
        const errorHandler = jest.fn<Response, [ typeof errorMessage ]>(() => ({
            body
        }))

        const response = await mockRequest({
            messageHandler: () => error<typeof errorMessage>(errorMessage),
            errorHandler
        })
        expect(errorHandler).toHaveBeenCalledTimes(1)
        expect(errorHandler).toHaveBeenCalledWith(errorMessage)
        expect(response._internal.buffer.toString('utf-8')).toBe(body)
    })

    test('exceptionHandler param called on messageHandler throw and response used', async () => {
        expect.assertions(3)

        const errorMessage = 'test'
        const body = 'test body'
        const exceptionHandler = jest.fn<Response, [ unknown ]>(() => ({
            body
        }))

        const response = await mockRequest({
            messageHandler: () => { throw errorMessage },
            exceptionHandler
        })
        expect(exceptionHandler).toHaveBeenCalledTimes(1)
        expect(exceptionHandler).toHaveBeenCalledWith(errorMessage)
        expect(response._internal.buffer.toString('utf-8')).toBe(body)
    })

    test('exceptionHandler param called on errorHandler throw and response used', async () => {
        expect.assertions(3)

        const message = 'test'
        const body = 'test body'
        const exceptionHandler = jest.fn<Response, [ unknown ]>(() => ({
            body
        }))

        const response = await mockRequest({
            messageHandler: error,
            errorHandler: () => { throw message },
            exceptionHandler
        })
        expect(exceptionHandler).toHaveBeenCalledTimes(1)
        expect(exceptionHandler).toHaveBeenCalledWith(message)
        expect(response._internal.buffer.toString('utf-8')).toBe(body)
    })

    test.todo('default error handler used when none given as parameter')

    test.todo('default exception handler used when none given as parameter')

    describe('string response', () => {
        const body = 'string body 🤔'
        const minimalState: Response = { body }
        const fullState: Response = {
            ...minimalState,
            status: 418,
            cookies: {
                'test cookie': {
                    value: 'test cookie value'
                },
                'test cookie 2': {
                    value: 'test cookie 2 value',
                    domain: 'test domain',
                    httpOnly: true,
                    maxAge: 123,
                    path: '/test/path',
                    sameSite: 'lax',
                    secure: true
                }
            },
            headers: {
                'x-test': 'test'
            }
        }

        test('status, cookies, headers, body passed to server response', async () => {
            expect.assertions(5)

            const response = await mockRequest({
                messageHandler: () => ok({ state: fullState })
            })
            const headers = response.getHeaders()

            expect(response._internal.ended).toBeTrue()
            expect(response.statusCode).toBe(fullState.status)
            expect(response._internal.buffer.toString('utf-8')).toBe(body)
            expect(headers).toContainEntries(
                Object.entries(fullState.headers!)
            )
            expect(headers).toContainEntry([
                'set-cookie',
                Object.entries(fullState.cookies!)
                    .map(([ name, value ]) =>
                        cookieHeader(name, value)
                    )
            ])
        })

        test('passes default status, content type, content length, and date', async () => {
            expect.assertions(4)

            const response = await mockRequest({
                messageHandler: () => ok({ state: minimalState })
            })
            const headers = response.getHeaders()

            expect(response.statusCode).toBe(200)
            expect(response._internal.buffer.toString('utf-8')).toBe(body)
            expect(headers).toContainEntries([
                [ 'content-length', Buffer.byteLength(body) ],
                [ 'content-type', 'text/plain; charset=utf-8' ]
            ])
            expect(headers).toContainKey('date')
        })

        test('messageHandler cleanup called', () => {
            expect.assertions(1)

            return mockRequest({
                messageHandler: () => ok({
                    state: minimalState,
                    cleanup: state => expect(state).toBe(minimalState)
                })
            })
        })
    })

    describe('buffer response', () => {
        const body = Buffer.from('buffer body 🤔', 'utf-8')
        const minimalState: Response = { body }
        const fullState: Response = {
            ...minimalState,
            status: 418,
            cookies: {
                'test cookie': {
                    value: 'test cookie value'
                },
                'test cookie 2': {
                    value: 'test cookie 2 value',
                    domain: 'test domain',
                    httpOnly: true,
                    maxAge: 123,
                    path: '/test/path',
                    sameSite: 'lax',
                    secure: true
                }
            },
            headers: {
                'x-test': 'test'
            }
        }

        test('status, cookies, headers, body passed to server response', async () => {
            expect.assertions(5)

            const response = await mockRequest({
                messageHandler: () => ok({ state: fullState })
            })
            const headers = response.getHeaders()

            expect(response._internal.ended).toBeTrue()
            expect(response.statusCode).toBe(fullState.status)
            expect(response._internal.buffer.toString('utf-8')).toBe(body.toString('utf-8'))
            expect(headers).toContainEntries(
                Object.entries(fullState.headers!)
            )
            expect(headers).toContainEntry([
                'set-cookie',
                Object.entries(fullState.cookies!)
                    .map(([ name, value ]) =>
                        cookieHeader(name, value)
                    )
            ])
        })

        test('passes default status, content type, content length, and date', async () => {
            expect.assertions(4)

            const response = await mockRequest({
                messageHandler: () => ok({ state: minimalState })
            })
            const headers = response.getHeaders()

            expect(response.statusCode).toBe(200)
            expect(response._internal.buffer.toString('utf-8')).toBe(body.toString('utf-8'))
            expect(headers).toContainEntries([
                [ 'content-length', body.length ],
                [ 'content-type', 'application/octet-stream' ]
            ])
            expect(headers).toContainKey('date')
        })

        test('messageHandler cleanup called', () => {
            expect.assertions(1)

            return mockRequest({
                messageHandler: () => ok({
                    state: minimalState,
                    cleanup: state => expect(state).toBe(minimalState)
                })
            })
        })
    })

    describe('stream response', () => {
        const body = 'stream body 🤔'
        const minimalState: Response = {
            body: {
                pipe: stream => stream.end(body, 'utf-8')
            }
        }
        const fullState: Response = {
            ...minimalState,
            status: 418,
            cookies: {
                'test cookie': {
                    value: 'test cookie value'
                },
                'test cookie 2': {
                    value: 'test cookie 2 value',
                    domain: 'test domain',
                    httpOnly: true,
                    maxAge: 123,
                    path: '/test/path',
                    sameSite: 'lax',
                    secure: true
                }
            },
            headers: {
                'x-test': 'test'
            }
        }

        test('status, cookies, headers, body passed to server response', async () => {
            expect.assertions(5)

            const response = await mockRequest({
                messageHandler: () => ok({ state: fullState })
            })
            const headers = response.getHeaders()

            expect(response._internal.ended).toBeTrue()
            expect(response.statusCode).toBe(fullState.status)
            expect(response._internal.buffer.toString('utf-8')).toBe(body)
            expect(headers).toContainEntries(
                Object.entries(fullState.headers!)
            )
            expect(headers).toContainEntry([
                'set-cookie',
                Object.entries(fullState.cookies!)
                    .map(([ name, value ]) =>
                        cookieHeader(name, value)
                    )
            ])
        })

        test('passes default status, content type, and date', async () => {
            expect.assertions(4)

            const response = await mockRequest({
                messageHandler: () => ok({ state: minimalState })
            })
            const headers = response.getHeaders()

            expect(response.statusCode).toBe(200)
            expect(response._internal.buffer.toString('utf-8')).toBe(body)
            expect(headers).toContainEntry([
                'content-type',
                'application/octet-stream'
            ])
            expect(headers).toContainKey('date')
        })

        test('messageHandler cleanup called', () => {
            expect.assertions(1)

            return mockRequest({
                messageHandler: () => ok({
                    state: minimalState,
                    cleanup: state => expect(state).toBe(minimalState)
                })
            })
        })
    })

    describe('empty response', () => {
        const minimalState: Response = {}
        const fullState: Response = {
            status: 418,
            cookies: {
                'test cookie': {
                    value: 'test cookie value'
                },
                'test cookie 2': {
                    value: 'test cookie 2 value',
                    domain: 'test domain',
                    httpOnly: true,
                    maxAge: 123,
                    path: '/test/path',
                    sameSite: 'lax',
                    secure: true
                }
            },
            headers: {
                'x-test': 'test'
            }
        }

        test('status, cookies, headers, body passed to server response', async () => {
            expect.assertions(5)

            const response = await mockRequest({
                messageHandler: () => ok({ state: fullState })
            })
            const headers = response.getHeaders()

            expect(response._internal.ended).toBeTrue()
            expect(response.statusCode).toBe(fullState.status)
            expect(response._internal.buffer.toString('utf-8')).toBe('')
            expect(headers).toContainEntries(
                Object.entries(fullState.headers!)
            )
            expect(headers).toContainEntry([
                'set-cookie',
                Object.entries(fullState.cookies!)
                    .map(([ name, value ]) =>
                        cookieHeader(name, value)
                    )
            ])
        })

        test('passes default status, content length, and date', async () => {
            expect.assertions(4)

            const response = await mockRequest({
                messageHandler: () => ok({ state: minimalState })
            })
            const headers = response.getHeaders()

            expect(response.statusCode).toBe(200)
            expect(response._internal.buffer.toString('utf-8')).toBe('')
            expect(headers).toContainEntry([ 'content-length', 0 ])
            expect(headers).toContainKey('date')
        })

        test('messageHandler cleanup called', () => {
            expect.assertions(1)

            return mockRequest({
                messageHandler: () => ok({
                    state: minimalState,
                    cleanup: state => expect(state).toBe(minimalState)
                })
            })
        })
    })

    describe('websocket response', () => {
        const server = createServer()
        const host = '127.0.0.1'

        beforeAll(done => server.listen(0, host, done))
        afterEach(() => server.removeAllListeners('request'))
        afterAll(done => server.close(done))

        function setupServerAndConnectClient<Error>(args: CreateRequestListenerArguments<Error>): Websocket {
            const address = server.address()
            let url: string
            if (address === null) {
                url = `ws://${host}`
            }
            else if (typeof address === 'string') {
                url = `ws://${address}`
            }
            else {
                url = `ws://${address.address}:${address.port}`
            }

            server.addListener('request', createRequestListener(args))

            return new Websocket(url)
        }

        test('onOpen called, onClose called, messages sent and received', async () => {
            expect.assertions(6)

            const onOpen = jest.fn<WebsocketGenerator, []>(function * () {
                yield 'server open'
                yield 'server open 2'
            })
            const onClose = jest.fn<void, [ number, string ]>()
            const onMessage = jest.fn<WebsocketGenerator, [ Data ]>(function * (message) {
                yield 'server message'
                yield `server echo: ${message}`
            })

            const messages: Data[] = []

            await new Promise<void>(resolve => {
                // simply listening for the client close event is not
                // enough, as the server request listener has not yet
                // returned at that point. we get around this by both
                // listening for the client close event and using the
                // messageHandler's cleanup callback.
                // conveniently, this also tests that said callback is
                // being called, as this test would fail with a timeout
                // error otherwise.
                let done = false

                function waitForOtherToFinish() {
                    if (done) {
                        resolve()
                    }
                    else {
                        done = true
                    }
                }

                const client = setupServerAndConnectClient({
                    messageHandler: () => ok({
                        state: {
                            body: { onOpen, onMessage, onClose }
                        },
                        cleanup: waitForOtherToFinish
                    })
                })
                client.on('open', () => client.send('client open'))
                client.on('message', message => {
                    messages.push(message)
                    if (messages.length >= 4) {
                        client.close(4321, 'client close')
                    }
                })
                client.on('close', waitForOtherToFinish)
            })

            expect(onOpen).toHaveBeenCalledTimes(1)
            expect(onOpen).toHaveBeenCalledBefore(onMessage)
            expect(onMessage.mock.calls).toEqual([ [ 'client open' ] ])
            expect(messages).toEqual([
                'server open',
                'server open 2',
                'server message',
                'server echo: client open'
            ])
            expect(onClose).toHaveBeenCalledAfter(onMessage)
            expect(onClose.mock.calls).toEqual([ [ 4321, 'client close' ] ])
        })

        test('passes cookies and headers, status always 101', () => {
            expect.assertions(3)

            const state: Response = {
                status: 418,
                body: {
                    onMessage: function * () {}
                },
                cookies: {
                    'test cookie': {
                        value: 'test cookie value'
                    },
                    'test cookie 2': {
                        value: 'test cookie 2 value',
                        domain: 'test domain',
                        httpOnly: true,
                        maxAge: 123,
                        path: '/test/path',
                        sameSite: 'lax',
                        secure: true
                    }
                },
                headers: {
                    'x-test': 'test'
                }
            }

            return new Promise<void>(resolve => {
                let done = false

                function waitForOtherToFinish() {
                    if (done) {
                        resolve()
                    }
                    else {
                        done = true
                    }
                }

                const client = setupServerAndConnectClient({
                    messageHandler: () => ok({
                        state,
                        cleanup: waitForOtherToFinish
                    })
                })
                client.on('upgrade', request => {
                    expect(request.statusCode).toBe(101)
                    expect(request.headers).toContainEntries(
                        Object.entries(state.headers!)
                    )
                    expect(request.headers).toContainEntry([
                        'set-cookie',
                        Object.entries(state.cookies!)
                            .map(([ name, value ]) =>
                                cookieHeader(name, value)
                            )
                    ])
                })
                client.on('open', () => client.close())
                client.on('close', waitForOtherToFinish)
            })
        })

        test('returning CloseWebSocket from onOpen closes connection', async () => {
            expect.assertions(2)

            const messages: Data[] = []

            const closeCode = await new Promise<number>(resolve => {
                let serverDone = false
                let clientCloseCode: number | undefined

                const client = setupServerAndConnectClient({
                    messageHandler: () => ok({
                        state: {
                            body: {
                                onOpen: function * () {
                                    yield 'server closing'
                                    return CloseWebSocket
                                },
                                onMessage: function * () {}
                            }
                        },
                        cleanup: () => {
                            if (clientCloseCode === undefined) {
                                serverDone = true
                            }
                            else {
                                resolve(clientCloseCode)
                            }
                        }
                    })
                })
                client.on('message', message => messages.push(message))
                client.on('close', code => {
                    if (serverDone) {
                        resolve(code)
                    }
                    else {
                        clientCloseCode = code
                    }
                })
            })

            expect(messages).toEqual([ 'server closing' ])
            expect(closeCode).toBe(1000)
        })

        test('returning CloseWebSocket from onMessage closes connection', async () => {
            expect.assertions(2)

            const messages: Data[] = []

            const closeCode = await new Promise<number>(resolve => {
                let serverDone = false
                let clientCloseCode: number | undefined

                const client = setupServerAndConnectClient({
                    messageHandler: () => ok({
                        state: {
                            body: {
                                onMessage: function * () {
                                    yield 'server closing'
                                    return CloseWebSocket
                                }
                            }
                        },
                        cleanup: () => {
                            if (clientCloseCode === undefined) {
                                serverDone = true
                            }
                            else {
                                resolve(clientCloseCode)
                            }
                        }
                    })
                })
                client.on('open', () => client.send('client open'))
                client.on('message', message => messages.push(message))
                client.on('close', code => {
                    if (serverDone) {
                        resolve(code)
                    }
                    else {
                        clientCloseCode = code
                    }
                })
            })

            expect(messages).toEqual([ 'server closing' ])
            expect(closeCode).toBe(1000)
        })

        test('stops sending messages if socket closes during generator', async () => {
            expect.assertions(2)

            const messages: Data[] = []

            const onClose = jest.fn<void, [ number, string ]>()

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

                const client = setupServerAndConnectClient({
                    messageHandler: () => ok({
                        state: {
                            body: {
                                onOpen: async function * () {
                                    yield 'a'
                                    await new Promise<void>(resolve =>
                                        setTimeout(resolve, 5)
                                    )
                                    yield 'b'
                                    yield 'c'
                                },
                                onMessage: function * () {},
                                onClose
                            }
                        },
                        cleanup: waitForOtherToFinish
                    })
                })
                client.on('message', message => {
                    messages.push(message)
                    client.close(1001)  // client leaving
                })
                client.on('close', waitForOtherToFinish)
            })

            expect(messages).toEqual([ 'a' ])
            expect(onClose.mock.calls).toEqual([
                [ 1001, expect.any(String) ]
            ])
        })

        test('onSendError called and socket closed on unknown send error', async () => {
            expect.assertions(4)

            const error = new Error('test')
            const onSendError = jest.fn<void, [ Data, Error ]>(() => {})
            const sendSpy = jest.spyOn(Websocket.prototype, 'send')

            const messages: Data[] = []

            const closeCode = await new Promise<number>(resolve => {
                let serverDone = false
                let clientCloseCode: number | undefined

                const client = setupServerAndConnectClient({
                    messageHandler: () => ok({
                        state: {
                            body: {
                                onOpen: function * () {
                                    yield 'a'
                                    // the wrong send overload is inferred so
                                    // the second parameter must be typed as any
                                    sendSpy.mockImplementationOnce((_, callback: any) =>
                                        callback(error)
                                    )
                                    yield 'b'
                                    yield 'c'
                                },
                                onMessage: function * () {},
                                onSendError
                            }
                        },
                        cleanup: () => {
                            if (clientCloseCode === undefined) {
                                serverDone = true
                            }
                            else {
                                resolve(clientCloseCode)
                            }
                        }
                    })
                })
                client.on('message', message => messages.push(message))
                client.on('close', code => {
                    if (serverDone) {
                        resolve(code)
                    }
                    else {
                        clientCloseCode = code
                    }
                })
            })

            expect(messages).toEqual([ 'a' ])
            expect(sendSpy.mock.calls).toEqual([
                [ 'a', expect.any(Function) ],
                [ 'b', expect.any(Function) ]
            ])
            expect(onSendError.mock.calls).toEqual([
                [ 'b', error ]
            ])
            expect(closeCode).toBe(1011)  // server error
        })
    })
})


describe('composeMessageHandlers', () => {
    test('handlers called in order with message and each successive state', async () => {
        expect.assertions(7)

        const request = new MockRequest()

        const a: MessageHandler<void, 'a', void> = (message, state) => {
            expect(message).toBe(request)
            expect(state).toBeUndefined()
            return ok({ state: 'a' })
        }

        const b: MessageHandler<'a', 'b', void> = (message, state) => {
            expect(message).toBe(request)
            expect(state).toBe('a')
            return ok({ state: 'b' })
        }

        const c: MessageHandler<'b', 'c', void> = (message, state) => {
            expect(message).toBe(request)
            expect(state).toBe('b')
            return ok({ state: 'c' })
        }

        const composed = composeMessageHandlers([ a, b, c ])
        const result = await composed(request)

        expect(result).toEqual(
            ok({ state: 'c' })
        )
    })

    test('cleanup returned if at least one handler had cleanup', async () => {
        const a: MessageHandler<void, void, void> = (_, state) =>
            ok({ state })
        const b: MessageHandler<void, void, void> = (_, state) =>
            ok({ state, cleanup: () => {} })
        const c: MessageHandler<void, void, void> = (_, state) =>
            ok({ state })

        const composed = composeMessageHandlers([ a, b, c ])
        // request should not be touched in this test so undefined is fine
        const result = await composed(undefined as any)
        expect(result.ok).toBeTrue()
        const { cleanup } = result.value as MessageHandlerResult<void>
        expect(cleanup).not.toBeUndefined()
    })

    test('cleanup calls handler cleanups in reverse order', async () => {
        const aCleanup = jest.fn<void, []>()
        const a: MessageHandler<void, void, void> = (_, state) =>
            ok({ state, cleanup: aCleanup })

        const bCleanup = jest.fn<void, []>()
        const b: MessageHandler<void, void, void> = (_, state) =>
            ok({ state, cleanup: bCleanup })

        const c: MessageHandler<void, void, void> = (_, state) =>
            ok({ state })

        const dCleanup = jest.fn<void, []>()
        const d: MessageHandler<void, void, void> = (_, state) =>
            ok({ state, cleanup: dCleanup })

        const composed = composeMessageHandlers([ a, b, c, d ])
        const handlerResult = await composed(undefined as any)

        expect(handlerResult.ok).toBeTrue()
        const { cleanup } = handlerResult.value as MessageHandlerResult<void>
        expect(cleanup).not.toBeUndefined()
        await cleanup!()

        expect(aCleanup).toHaveBeenCalledTimes(1)
        expect(bCleanup).toHaveBeenCalledTimes(1)
        expect(dCleanup).toHaveBeenCalledTimes(1)
        expect(aCleanup).toHaveBeenCalledAfter(bCleanup)
        expect(bCleanup).toHaveBeenCalledAfter(dCleanup)
    })

    test('on handler error, cleanups of previous handlers called in reverse order and error returned ', async () => {
        const testError = 'test'

        const aCleanup = jest.fn<void, []>()
        const a: MessageHandler<void, void, typeof testError> = (_, state) =>
            ok({ state, cleanup: aCleanup })

        const bCleanup = jest.fn<void, []>()
        const b: MessageHandler<void, void, typeof testError> = (_, state) =>
            ok({ state, cleanup: bCleanup })

        const c: MessageHandler<void, void, typeof testError> = () =>
            error(testError)

        const dCleanup = jest.fn<void, []>()
        const d: MessageHandler<void, void, typeof testError> = (_, state) =>
            ok({ state, cleanup: dCleanup })

        const composed = composeMessageHandlers([ a, b, c, d ])
        const result = await composed(undefined as any)

        expect(result).toEqual(error(testError))
        expect(aCleanup).toHaveBeenCalledTimes(1)
        expect(bCleanup).toHaveBeenCalledTimes(1)
        expect(dCleanup).not.toHaveBeenCalled()
        expect(aCleanup).toHaveBeenCalledAfter(bCleanup)
    })
})


describe('fallthroughMessageHandler', () => {

})
