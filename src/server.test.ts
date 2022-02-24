import { error, ok, Ok, Result } from 'fallible'
import 'jest-extended'

import { response } from './general-utils.js'
import { composeMessageHandlers, composeResultMessageHandlers, fallthroughMessageHandler } from './server.js'
import type { MessageHandler } from './types.js'


describe('createRequestListener', () => {
    describe('shared', () => {
        test.todo('exceptionListener called and response ended when messageListener throws')

        test.todo('exceptionListener called again when ending response throws')

        test.todo('default exception handler used when none given as parameter')

        test.todo('messageHandler sockets parameter')
    })

    describe('string body', () => {
        test.todo('writes default status, content type, content length')

        test.todo('writes custom status, cookies, headers')

        test.todo('exceptionListener called when response errors')

        test.todo('exceptionListener called when request cancelled during response')
    })

    describe('buffer body', () => {
        test.todo('writes default status, content type, content length')

        test.todo('writes custom status, cookies, headers')

        test.todo('exceptionListener called when response errors')

        test.todo('exceptionListener called when request cancelled during response')
    })

    describe('no body', () => {
        test.todo('writes default status, content length')

        test.todo('writes custom status, cookies, headers')

        test.todo('exceptionListener called when response errors')

        test.todo('exceptionListener called when request cancelled during response')
    })

    describe('stream body', () => {
        test.todo('writes default status, content length')

        test.todo('writes custom status, cookies, headers')

        test.todo('exceptionListener called when stream errors')

        test.todo('exceptionListener called when response errors')

        test.todo('exceptionListener called when request cancelled during response')
    })

    describe('websockets', () => {
        test.todo('onOpen called, onClose called, messages sent and received')

        test.todo('ignores status, cookies, headers')

        test.todo('returning CloseWebsocket from onOpen closes connection')

        test.todo('returning CloseWebsocket from onMessage closes connection')

        test.todo('stops sending messages if socket closes during generator')

        test.todo('onSendError called and socket closed on unknown send error')
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
