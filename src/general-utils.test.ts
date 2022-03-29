import type { IncomingHttpHeaders } from 'http'

import type { Cleanup, WebsocketBody } from './types.js'
import {
    getMessageIP,
    parseCharSetContentTypeHeader,
    parseContentLengthHeader,
    parseAuthorizationHeaderBearer,
    headersIndicateWebSocketRequest,
    parseJSONString,
    response,
    websocketResponse,
    iterateAsResolved,
    ParsedContentType
} from './general-utils.js'


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


describe('websocketResponse', () => {
    const body: WebsocketBody = {
        onMessage: function * () {},
        onClose: () => {},
        onOpen: function * () {},
        onSendError: () => {}
    }

    test('body argument', () => {
        const result = websocketResponse(body)
        expect(result).toEqual<typeof result>({
            state: { body }
        })
    })

    test('cleanup argument', () => {
        const cleanup: Cleanup = () => {}
        const result = websocketResponse(body, cleanup)
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
