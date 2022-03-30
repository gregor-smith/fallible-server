import type { IncomingHttpHeaders } from 'node:http'

import { ok, error, Result, Ok } from 'fallible'

import type {
    Cleanup,
    MessageHandler,
    Response,
    WebSocketBody
} from './types.js'
import {
    getMessageIP,
    parseCharSetContentTypeHeader,
    parseContentLengthHeader,
    parseAuthorizationHeaderBearer,
    headersIndicateWebSocketRequest,
    parseJSONString,
    response,
    webSocketResponse,
    iterateAsResolved,
    ParsedContentType,
    fallthroughMessageHandler,
    composeMessageHandlers,
    composeResultMessageHandlers,
    MessageHandlerComposer,
    ResultMessageHandlerComposer
} from './utils.js'


describe('parseJSONString', () => {
    test.each([
        '{',
        '{"constructor": {}}',
        '{"__proto__": {}}',
    ])('throws on invalid or malicious json string', json => {
        expect(() => parseJSONString(json)).toThrowError(SyntaxError)
    })

    test('parses json string', () => {
        const result = parseJSONString('{"test":true}')
        expect(result).toEqual({ test: true })
    })
})


describe('getMessageIP', () => {
    test('returns socket remote address when useXForwardedFor false', () => {
        const remoteAddress = 'test socket remote address'
        const result = getMessageIP({
            headers: {},
            socket: { remoteAddress }
        })
        expect(result).toBe(remoteAddress)
    })

    test.each<string | string[]>([
        'test-x-forwarded-address',
        'test-x-forwarded-address, other',
        ' test-x-forwarded-address  , other',
        [ 'test-x-forwarded-address', 'other' ],
        [ '  test-x-forwarded-address ', 'other' ],
        [ 'test-x-forwarded-address, other', 'other 2' ],
        [ ' test-x-forwarded-address  , other', 'other 2' ],
    ])('returns first entry of x-forwarded-for header when useXForwardedFor true', header => {
        const result = getMessageIP({
            headers: {
                'x-forwarded-for': header
            },
            socket: {}
        }, true)
        expect(result).toBe('test-x-forwarded-address')
    })

    test.each([
        '',
        ' ',
    ])('returns socket remote address when x-forwarded-for header invalid', header => {
        const remoteAddress = 'test socket remote address'
        const result = getMessageIP({
            headers: {
                'x-forwarded-for': header
            },
            socket: { remoteAddress }
        }, true)
        expect(result).toBe(remoteAddress)
    })
})


describe('parseCharSetContentTypeHeader', () => {
    test.each([
        '',
        ' '
    ])('returns undefined when header empty', header => {
        const result = parseCharSetContentTypeHeader(header)
        expect(result).toBeUndefined()
    })

    test.each<[ string, ParsedContentType ]>([
        [ 'test/type', { type: 'test/type' } ],
        [ 'Test/Type', { type: 'test/type' } ],
        [ ' test/type ', { type: 'test/type' } ],
        [ 'test/type;charset=utf-8', { type: 'test/type', characterSet: 'utf-8' } ],
        [ 'Test/Type;Charset=UTF-8', { type: 'test/type', characterSet: 'utf-8' } ],
        [ ' test/type ; charset = utf-8 ', { type: 'test/type', characterSet: 'utf-8' } ],
        [ 'test/type;charset="utf-8"', { type: 'test/type', characterSet: 'utf-8' } ],
        [ 'Test/Type;Charset="UTF-8"', { type: 'test/type', characterSet: 'utf-8' } ],
        [ ' test/type ; charset = "utf-8" ', { type: 'test/type', characterSet: 'utf-8' } ],
        [ 'test/type; other-directive=true', { type: 'test/type; other-directive=true' } ],
    ])('returns parsed header', (header, contentType) => {
        const result = parseCharSetContentTypeHeader(header)
        expect(result?.type).toBe(contentType.type)
        expect(result?.characterSet).toBe(contentType.characterSet)
    })
})


describe('parseContentLengthHeader', () => {
    test.each([ '', ' ', 'test', '1.1' ])('returns undefined when header not an integer', header => {
        const result = parseContentLengthHeader(header)
        expect(result).toBeUndefined()
    })

    test.each([ '1', ' 2 ' ])('returns parsed integer', header => {
        const result = parseContentLengthHeader(header)
        expect(result).toBe(Number(header))
    })
})


describe('parseAuthorizationHeaderBearer', () => {
    test.each([
        '',
        ' ',
        'test',
        'Bearer',
        'Bearer ',
        'Bearer  ',
        '  Bearer',
        '  Bearer ',
        '  Bearer  ',
        'bearer',
        'bearer ',
        'bearer  ',
        '  bearer',
        '  bearer ',
        '  bearer  ',
        'bearer test',
        'Bearer 🤔',
        'Bearer  test'
    ])('returns undefined when header invalid', header => {
        const result = parseAuthorizationHeaderBearer(header)
        expect(result).toBeUndefined()
    })

    test('returns parsed value', () => {
        const result = parseAuthorizationHeaderBearer('Bearer Test1-._~+/')
        expect(result).toBe('Test1-._~+/')
    })
})


describe('headersIndicateWebSocketRequest', () => {
    const headers: IncomingHttpHeaders = {
        connection: 'upgrade',
        upgrade: 'websocket',
        'sec-websocket-key': 'test',
        'sec-websocket-version': 'test'
    }

    test.each([
        'upgrade',
        'Upgrade'
    ])('returns true when connection header is upgrade, upgrade header is websocket, and security headers are present', header => {
        const result = headersIndicateWebSocketRequest({
            ...headers,
            connection: header
        })
        expect(result).toBe(true)
    })

    test.each([
        undefined,
        'test'
    ])('returns false when connection header missing or not upgrade', header => {
        const result = headersIndicateWebSocketRequest({
            ...headers,
            connection: header
        })
        expect(result).toBe(false)
    })

    test.each([
        'test',
        undefined
    ])('returns false when upgrade header missing or non-websocket', header => {
        const result = headersIndicateWebSocketRequest({
            ...headers,
            upgrade: header
        })
        expect(result).toBe(false)
    })

    test('returns false when security key header missing', () => {
        const result = headersIndicateWebSocketRequest({
            ...headers,
            'sec-websocket-key': undefined
        })
        expect(result).toBe(false)
    })

    test('returns false when security version header missing', () => {
        const result = headersIndicateWebSocketRequest({
            ...headers,
            'sec-websocket-version': undefined
        })
        expect(result).toBe(false)
    })
})



describe('response', () => {
    const state = 'test'

    test('no arguments', () => {
        const result = response()
        expect(result).toEqual<typeof result>({ state: undefined })
    })

    test('state argument', () => {
        const result = response(state)
        expect(result).toEqual<typeof result>({ state })
    })

    test('cleanup argument', () => {
        const cleanup: Cleanup = () => {}
        const result = response(state, cleanup)
        expect(result).toEqual<typeof result>({ state, cleanup })
    })
})


describe('webSocketResponse', () => {
    const body: WebSocketBody = {
        onMessage: function * () {},
        onClose: () => {},
        onOpen: function * () {},
        onSendError: () => {}
    }

    test('body argument', () => {
        const result = webSocketResponse(body)
        expect(result).toEqual<typeof result>({
            state: { body }
        })
    })

    test('cleanup argument', () => {
        const cleanup: Cleanup = () => {}
        const result = webSocketResponse(body, cleanup)
        expect(result).toEqual<typeof result>({
            state: { body },
            cleanup
        })
    })
})


describe('iterateAsResolved', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(jest.useRealTimers)

    test('yields values as their promises resolve', async () => {
        expect.assertions(5)

        const createPromise = <T>(value: T, ms: number): Promise<T> =>
            new Promise(resolve => setTimeout(() => resolve(value), ms))

        const promises: Promise<string>[] = [
            createPromise('a', 400),
            createPromise('b', 100),
            createPromise('c', 300),
            createPromise('d', 200)
        ]

        const generator = iterateAsResolved(promises)

        jest.advanceTimersByTime(100)
        let result = await generator.next()
        expect(result).toEqual<typeof result>({ done: false, value: 'b' })

        jest.advanceTimersByTime(100)
        result = await generator.next()
        expect(result).toEqual<typeof result>({ done: false, value: 'd' })

        jest.advanceTimersByTime(100)
        result = await generator.next()
        expect(result).toEqual<typeof result>({ done: false, value: 'c' })

        jest.advanceTimersByTime(100)
        result = await generator.next()
        expect(result).toEqual<typeof result>({ done: false, value: 'a' })

        result = await generator.next()
        expect(result).toEqual<typeof result>({ done: true, value: undefined })
    })
})


describe('parseJSONStream', () => {
    test.todo('returns MaximumSizeExceeded when stream larger than maximumSize param')

    test.todo('returns DecodeError when stream buffer cannot be decoded')

    test.todo('returns InvalidSyntax when JSON cannot be parsed')

    test.todo('returns JSON decoded with given charset')
})


describe('fallthroughMessageHandler', () => {
    test("calls handlers in order and returns first response that doesn't match isNext func", async () => {
        expect.assertions(9)

        const testState = Symbol()
        const testMessage = Symbol() as any
        const testSockets = Symbol() as any

        const a = jest.fn(() => response('test'))
        const b = jest.fn(() => response('test2'))
        const c = jest.fn(() => response(3))
        const d = jest.fn(() => response('test4'))
        const e = jest.fn(() => response(5))

        const composed = fallthroughMessageHandler<typeof testState, number, string>(
            [ a, b, c, d ],
            e,
            (state): state is string => typeof state === 'string'
        )
        const { state, cleanup } = await composed(testMessage, testState, testSockets)

        expect(cleanup).toBeFunction()
        expect(state).toBe(3)

        expect(a.mock.calls).toEqual([ [ testMessage, testState, testSockets ] ])
        expect(b.mock.calls).toEqual([ [ testMessage, testState, testSockets ] ])
        expect(c.mock.calls).toEqual([ [ testMessage, testState, testSockets ] ])
        expect(d).not.toHaveBeenCalled()
        expect(e).not.toHaveBeenCalled()
        expect(a).toHaveBeenCalledBefore(b)
        expect(b).toHaveBeenCalledBefore(c)
    })

    test("returns response with noMatch parameter as state if all handlers' responses match isNext", async () => {
        expect.assertions(2)

        const a: MessageHandler<void, string> = () => response('test')
        const b: MessageHandler<void, string> = () => response('test2')
        const c: MessageHandler<void, string> = () => response('test3')
        const d: MessageHandler<void, number> = () => response(4)

        const composed = fallthroughMessageHandler<void, number, string>(
            [ a, b, c ],
            d,
            (state): state is string => typeof state === 'string',
        )
        const { state, cleanup } = await composed(undefined as any, undefined, undefined as any)

        expect(cleanup).toBeFunction()
        expect(state).toBe(4)
    })

    test('cleanup calls cleanups of all handlers up to match', async () => {
        expect.assertions(7)

        const aCleanup = jest.fn<void, []>()
        const a: MessageHandler<void, string> = () => response('test', aCleanup)

        const bCleanup = jest.fn<void, []>()
        const b: MessageHandler<void, string> = () => response('test2', bCleanup)

        const c: MessageHandler<void, string> = () => response('test3')

        const dCleanup = jest.fn<void, []>()
        const d: MessageHandler<void, number> = () => response(4, dCleanup)

        const eCleanup = jest.fn<void, []>()
        const e: MessageHandler<void, string> = () => response('test5', eCleanup)

        const fCleanup = jest.fn<void, []>()
        const f: MessageHandler<void, number> = () => response(6, fCleanup)

        const composed = fallthroughMessageHandler<void, number, string>(
            [ a, b, c, d, e ],
            f,
            (state): state is string => typeof state === 'string'
        )
        const { cleanup } = await composed(undefined as any, undefined, undefined as any)
        const state: Response = { body: 'test' }
        await cleanup?.(state)

        expect(aCleanup.mock.calls).toEqual([ [ state ] ])
        expect(bCleanup.mock.calls).toEqual([ [ state ] ])
        expect(dCleanup.mock.calls).toEqual([ [ state ] ])
        expect(eCleanup).not.toHaveBeenCalled()
        expect(fCleanup).not.toHaveBeenCalled()
        expect(aCleanup).toHaveBeenCalledAfter(bCleanup)
        expect(bCleanup).toHaveBeenCalledAfter(dCleanup)
    })

    test('cleanup calls cleanups of all handlers on no match', async () => {
        expect.assertions(5)

        const aCleanup = jest.fn<void, []>()
        const a: MessageHandler<void, string> = () => response('test', aCleanup)

        const b: MessageHandler<void, string> = () => response('test2')

        const cCleanup = jest.fn<void, []>()
        const c: MessageHandler<void, string> = () => response('test3', cCleanup)

        const dCleanup = jest.fn<void, []>()
        const d: MessageHandler<void, number> = () => response(4, dCleanup)

        const composed = fallthroughMessageHandler<void, number, string>(
            [ a, b, c ],
            d,
            (state): state is string => typeof state === 'string'
        )
        const { cleanup } = await composed(undefined as any, undefined, undefined as any)
        const state: Response = { body: 'test' }
        await cleanup?.(state)

        expect(aCleanup.mock.calls).toEqual([ [ state ] ])
        expect(cCleanup.mock.calls).toEqual([ [ state ] ])
        expect(dCleanup.mock.calls).toEqual([ [ state ] ])
        expect(aCleanup).toHaveBeenCalledAfter(cCleanup)
        expect(cCleanup).toHaveBeenCalledAfter(dCleanup)
    })
})


describe('composeMessageHandlers', () => {
    test('handlers called in order with message, sockets and each successive state', async () => {
        expect.assertions(8)

        const testMessage = Symbol() as any
        const testSockets = Symbol() as any

        const a: MessageHandler<number, number> = (message, state, sockets) => {
            expect(message).toBe(testMessage)
            expect(state).toBe(1)
            expect(sockets).toBe(testSockets)
            return response(2)
        }
        const b: MessageHandler<number, number> = (message, state, sockets) => {
            expect(message).toBe(testMessage)
            expect(state).toBe(2)
            expect(sockets).toBe(testSockets)
            return response(3)
        }

        const composed = composeMessageHandlers(a, b)
        const { state, cleanup } = await composed(testMessage, 1, testSockets)

        expect(cleanup).toBeFunction()
        expect(state).toBe(3)
    })

    test('cleanup calls handler cleanups in reverse order', async () => {
        expect.assertions(3)

        const aCleanup = jest.fn<void, []>()
        const a: MessageHandler<void, null> = () => response(null, aCleanup)

        const bCleanup = jest.fn<void, []>()
        const b: MessageHandler<null, null> = () => response(null, bCleanup)

        const composed = composeMessageHandlers(a, b)
        const { cleanup } = await composed(undefined as any, undefined, undefined as any)
        const state: Response = { body: 'test' }
        await cleanup?.(state)

        expect(aCleanup.mock.calls).toEqual([ [ state ] ])
        expect(bCleanup.mock.calls).toEqual([ [ state ] ])
        expect(bCleanup).toHaveBeenCalledBefore(aCleanup)
    })
})


describe('composeResultMessageHandlers', () => {
    test('handlers called in order with message, sockets and each successive state', async () => {
        expect.assertions(8)

        const testMessage = Symbol() as any
        const testSockets = Symbol() as any

        const a: MessageHandler<number, Ok<number>> = (message, state, sockets) => {
            expect(message).toBe(testMessage)
            expect(state).toBe(1)
            expect(sockets).toBe(testSockets)
            return response(ok(2))
        }
        const b: MessageHandler<number, Ok<number>> = (message, state, sockets) => {
            expect(message).toBe(testMessage)
            expect(state).toBe(2)
            expect(sockets).toBe(testSockets)
            return response(ok(3))
        }

        const composed = composeResultMessageHandlers(a, b)
        const { state, cleanup } = await composed(testMessage, 1, testSockets)

        expect(cleanup).toBeFunction()
        expect(state).toEqual(ok(3))
    })

    test('error response from composed handler is returned immediately', async () => {
        expect.assertions(2)

        const a: MessageHandler<number, Result<number, string>> = () =>
            response(error('test'))
        const b: MessageHandler<number, Result<number, string>> = () =>
            response(ok(3))

        const composed = composeResultMessageHandlers(a, b)
        const { state, cleanup } = await composed(undefined as any, 1, undefined as any)

        expect(cleanup).toBeUndefined()
        expect(state).toEqual(error('test'))
    })

    test('cleanup calls handler cleanups in reverse order', async () => {
        expect.assertions(3)

        const aCleanup = jest.fn<void, []>()
        const a: MessageHandler<void, Result<void, unknown>> = () =>
            response(ok(), aCleanup)

        const bCleanup = jest.fn<void, []>()
        const b: MessageHandler<void, Result<void, unknown>> = () =>
            response(ok(), bCleanup)

        const composed = composeResultMessageHandlers(a, b)
        const { cleanup } = await composed(undefined as any, undefined, undefined as any)
        const state: Response = { body: 'test' }
        await cleanup?.(state)

        expect(aCleanup.mock.calls).toEqual([ [ state ] ])
        expect(bCleanup.mock.calls).toEqual([ [ state ] ])
        expect(bCleanup).toHaveBeenCalledBefore(aCleanup)
    })

    test('error response cleanup calls only previous cleanups in reverse order', async () => {
        expect.assertions(2)

        const aCleanup = jest.fn<void, []>()
        const a: MessageHandler<void, Result<void, unknown>> = () =>
            response(error(), aCleanup)

        const bCleanup = jest.fn<void, []>()
        const b: MessageHandler<void, Result<void, unknown>> = () =>
            response(ok(), bCleanup)

        const composed = composeResultMessageHandlers(a, b)
        const { cleanup } = await composed(undefined as any, undefined, undefined as any)
        const state: Response = { body: 'test' }
        await cleanup?.(state)

        expect(aCleanup.mock.calls).toEqual([ [ state ] ])
        expect(bCleanup).not.toHaveBeenCalled()
    })
})


describe('MessageHandlerComposer', () => {
    test('handlers called in order with message, sockets and each successive state', async () => {
        expect.assertions(8)

        const testMessage = Symbol() as any
        const testSockets = Symbol() as any

        const a: MessageHandler<number, number> = (message, state, sockets) => {
            expect(message).toBe(testMessage)
            expect(state).toBe(1)
            expect(sockets).toBe(testSockets)
            return response(2)
        }
        const b: MessageHandler<number, number> = (message, state, sockets) => {
            expect(message).toBe(testMessage)
            expect(state).toBe(2)
            expect(sockets).toBe(testSockets)
            return response(3)
        }

        const composed = new MessageHandlerComposer(a).intoHandler(b).build()
        const { state, cleanup } = await composed(testMessage, 1, testSockets)

        expect(cleanup).toBeFunction()
        expect(state).toBe(3)
    })

    test('cleanup calls handler cleanups in reverse order', async () => {
        expect.assertions(3)

        const aCleanup = jest.fn<void, []>()
        const a: MessageHandler<void, null> = () => response(null, aCleanup)

        const bCleanup = jest.fn<void, []>()
        const b: MessageHandler<null, null> = () => response(null, bCleanup)

        const composed = new MessageHandlerComposer(a).intoHandler(b).build()
        const { cleanup } = await composed(undefined as any, undefined, undefined as any)
        const state: Response = { body: 'test' }
        await cleanup?.(state)

        expect(aCleanup.mock.calls).toEqual([ [ state ] ])
        expect(bCleanup.mock.calls).toEqual([ [ state ] ])
        expect(bCleanup).toHaveBeenCalledBefore(aCleanup)
    })
})


describe('ResultMessageHandlerComposer', () => {
    test('handlers called in order with message, sockets and each successive state', async () => {
        expect.assertions(8)

        const testMessage = Symbol() as any
        const testSockets = Symbol() as any

        const a: MessageHandler<number, Ok<number>> = (message, state, sockets) => {
            expect(message).toBe(testMessage)
            expect(state).toBe(1)
            expect(sockets).toBe(testSockets)
            return response(ok(2))
        }
        const b: MessageHandler<number, Ok<number>> = (message, state, sockets) => {
            expect(message).toBe(testMessage)
            expect(state).toBe(2)
            expect(sockets).toBe(testSockets)
            return response(ok(3))
        }

        const composed = new ResultMessageHandlerComposer(a).intoResultHandler(b).build()
        const { state, cleanup } = await composed(testMessage, 1, testSockets)

        expect(cleanup).toBeFunction()
        expect(state).toEqual(ok(3))
    })

    test('error response from composed handler is returned immediately', async () => {
        expect.assertions(2)

        const a: MessageHandler<number, Result<number, string>> = () =>
            response(error('test'))
        const b: MessageHandler<number, Result<number, string>> = () =>
            response(ok(3))

        const composed = new ResultMessageHandlerComposer(a).intoResultHandler(b).build()
        const { state, cleanup } = await composed(undefined as any, 1, undefined as any)

        expect(cleanup).toBeUndefined()
        expect(state).toEqual(error('test'))
    })

    test('cleanup calls handler cleanups in reverse order', async () => {
        expect.assertions(3)

        const aCleanup = jest.fn<void, []>()
        const a: MessageHandler<void, Result<void, unknown>> = () =>
            response(ok(), aCleanup)

        const bCleanup = jest.fn<void, []>()
        const b: MessageHandler<void, Result<void, unknown>> = () =>
            response(ok(), bCleanup)

        const composed = new ResultMessageHandlerComposer(a).intoResultHandler(b).build()
        const { cleanup } = await composed(undefined as any, undefined, undefined as any)
        const state: Response = { body: 'test' }
        await cleanup?.(state)

        expect(aCleanup.mock.calls).toEqual([ [ state ] ])
        expect(bCleanup.mock.calls).toEqual([ [ state ] ])
        expect(bCleanup).toHaveBeenCalledBefore(aCleanup)
    })

    test('error response cleanup calls only previous cleanups in reverse order', async () => {
        expect.assertions(2)

        const aCleanup = jest.fn<void, []>()
        const a: MessageHandler<void, Result<void, unknown>> = () =>
            response(error(), aCleanup)

        const bCleanup = jest.fn<void, []>()
        const b: MessageHandler<void, Result<void, unknown>> = () =>
            response(ok(), bCleanup)

        const composed = new ResultMessageHandlerComposer(a).intoResultHandler(b).build()
        const { cleanup } = await composed(undefined as any, undefined, undefined as any)
        const state: Response = { body: 'test' }
        await cleanup?.(state)

        expect(aCleanup.mock.calls).toEqual([ [ state ] ])
        expect(bCleanup).not.toHaveBeenCalled()
    })
})
