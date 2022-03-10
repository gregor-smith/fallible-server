import type { IncomingHttpHeaders } from 'http'

import { ok, error, Error, Ok } from 'fallible'
import Keygrip from 'keygrip'

import type {
    Cleanup,
    Cookie,
    WebsocketBody
} from './types.js'
import {
    cookieHeader,
    cookieSignatureHeader,
    parseMessageCookie,
    getMessageHeader,
    getMessageIP,
    getMessageMethod,
    getMessageURL,
    parseMessageContentLength,
    parseMessageContentType,
    parseURLHash,
    parseURLQueryString,
    parseSignedMessageCookie,
    parseURLPath,
    parseCookieHeader,
    parseContentTypeHeader,
    parseContentLengthHeader,
    parseAuthorizationHeaderBearer,
    parseMessageAuthorizationHeaderBearer,
    messageIsWebSocketRequest,
    parseJSONString,
    ParseSignedMessageCookieError,
    joinURLQueryString,
    parseURLPathSegments,
    response,
    websocketResponse,
    iterateAsResolved,
    ParsedContentType,
    contentDispositionHeader,
    URLParser
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


describe('contentDispositionHeader', () => {
    test('inline', () => {
        const result = contentDispositionHeader('inline')
        expect(result).toBe<typeof result>('inline')
    })

    test('attachment without filename', () => {
        const result = contentDispositionHeader('attachment')
        expect(result).toBe<typeof result>('attachment')
    })

    test('attachment with filename', () => {
        const result = contentDispositionHeader('attachment', 'test 🤔')
        expect(result).toBe<typeof result>(`attachment; filename="test%20%F0%9F%A4%94"`)
    })
})


describe('parseCookieHeader', () => {
    test.each([
        'test',
        'test=value',
        'test=value; test2=value2; test3=value3'
    ])('returns undefined when name missing from header', header => {
        const result = parseCookieHeader(header, 'test4')
        expect(result).toBeUndefined()
    })

    test.each([
        [ 'test=value; test2=value2; test3=value3', 'value2' ],
        [ 'test2=value', 'value' ]
    ])('returns cookie value', (header, value) => {
        const result = parseCookieHeader(header, 'test2')
        expect(result).toBe(value)
    })
})


describe('parseMessageCookie', () => {
    test('returns undefined when cookie header missing', () => {
        const result = parseMessageCookie({ headers: {} }, 'test')
        expect(result).toBeUndefined()
    })

    test.each([
        'test',
        'test=value',
        'test=value; test2=value2; test3=value3'
    ])('returns undefined when name missing from cookie header', header => {
        const result = parseMessageCookie({ headers: { cookie: header } }, 'test4')
        expect(result).toBeUndefined()
    })

    test.each([
        [ 'test=value; test2=value2; test3=value3', 'value2' ],
        [ 'test2=value', 'value' ]
    ])('returns cookie value', (header, value) => {
        const result = parseMessageCookie({ headers: { cookie: header } }, 'test2')
        expect(result).toBe(value)
    })
})


describe('parseSignedMessageCookie', () => {
    test('returns ValueCookieMissing when cookie header missing', () => {
        const result = parseSignedMessageCookie(
            { headers: {} },
            'test',
            new Keygrip([ 'test key' ])
        )
        expect(result).toEqual<Error<ParseSignedMessageCookieError>>(
            error('ValueCookieMissing')
        )
    })

    test.each([
        'test',
        'test=value',
        'test=value; test2=value2; test3=value3'
    ])('returns ValueCookieMissing when name missing from cookie header', header => {
        const result = parseSignedMessageCookie(
            { headers: { cookie: header } },
            'test4',
            new Keygrip([ 'test key' ])
        )
        expect(result).toEqual<Error<ParseSignedMessageCookieError>>(
            error('ValueCookieMissing')
        )
    })

    test.each([
        'test=value',
        'test=value; test2=value2; test3=value3'
    ])('returns SignatureCookieMissing when signature name missing from cookie header', header => {
        const result = parseSignedMessageCookie(
            { headers: { cookie: header } },
            'test',
            new Keygrip([ 'test key' ])
        )
        expect(result).toEqual<Error<ParseSignedMessageCookieError>>(
            error('SignatureCookieMissing')
        )
    })

    test.each([
        [ 'test=value; test.sig=ItukCx0lb6-dY71Zps-69Gkz5XE', 'test' ],
        [ 'test2=value2; test2.sig=JLS-pHsjhoJAExITxBFTj8jko5o', 'test2' ]
    ])('returns SignatureInvalid when signature does not match', (header, name) => {
        const result = parseSignedMessageCookie(
            { headers: { cookie: header } },
            name,
            new Keygrip([ 'invalid key' ])
        )
        expect(result).toEqual<Error<ParseSignedMessageCookieError>>(
            error('SignatureInvalid')
        )
    })

    test.each([
        [ 'test=value; test.sig=ItukCx0lb6-dY71Zps-69Gkz5XE', 'test', 'value', 'test key' ],
        [ 'test2=value2; test2.sig=JLS-pHsjhoJAExITxBFTj8jko5o', 'test2', 'value2', 'test key 2' ]
    ])('returns cookie value', (header, name, value, key) => {
        const result = parseSignedMessageCookie(
            { headers: { cookie: header } },
            name,
            new Keygrip([ key ])
        )
        expect(result).toEqual<Ok<string>>(ok(value))
    })
})


describe('cookieHeader', () => {
    test.each<[ string, Cookie, string ]>([
        [
            'test-cookie',
            { value: 'test value' },
            'test-cookie=test value'
        ],
        [
            'test-cookie-2',
            {
                value: 'test value 2',
                path: '/test/path',
                maxAge: 1337,
                domain: 'test.domain',
                httpOnly: true,
                sameSite: 'lax',
                secure: true
            },
            'test-cookie-2=test value 2; Path=/test/path; Max-Age=1337; Domain=test.domain; SameSite=lax; Secure; HttpOnly'
        ]
    ])('returns formatted cookie', (name, cookie, header) => {
        const result = cookieHeader(name, cookie)
        expect(result).toBe(header)
    })
})


describe('cookieSignatureHeader', () => {
    test.each<[ string, Cookie, string, string ]>([
        [
            'test-cookie',
            { value: 'test value' },
            'test key',
            'test-cookie.sig=7LcOkGwGNIdyT4SLKCdgLl0ayb0'
        ],
        [
            'test-cookie-2',
            {
                value: 'test value 2',
                path: '/test/path',
                maxAge: 1337,
                domain: 'test.domain',
                httpOnly: true,
                sameSite: 'lax',
                secure: true
            },
            'test key 2',
            'test-cookie-2.sig=47eK_2MpYl2oFIWr2WmPDwXWZmg; Path=/test/path; Max-Age=1337; Domain=test.domain; SameSite=lax; Secure; HttpOnly'
        ]
    ])('returns signature header signed with key', (name, cookie, key, header) => {
        const result = cookieSignatureHeader(name, cookie, new Keygrip([ key ]))
        expect(result).toBe(header)
    })
})


describe('getMessageHeader', () => {
    test.each<[ IncomingHttpHeaders, string | undefined ]>([
        [ {}, undefined ],
        [ { 'test-header': 'test value' }, 'test value' ],
        [ { 'test-header': [ 'test value' ] }, 'test value' ]
    ])('returns first value if array, otherwise whole header', (headers, header) => {
        const result = getMessageHeader({ headers }, 'test-header')
        expect(result).toBe(header)
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


describe('getMessageMethod', () => {
    test.each([
        'post',
        'get',
    ])('returns uppercase method', method => {
        const result = getMessageMethod({ method })
        expect(result).toBe(method.toUpperCase())
    })

    test('returns GET when method undefined', () => {
        const result = getMessageMethod({})
        expect(result).toBe('GET')
    })
})


describe('getMessageURL', () => {
    test.each([ '/', '/test' ])('returns URL', url => {
        const result = getMessageURL({ url })
        expect(result).toBe(url)
    })

    test("returns '/' when url undefined", () => {
        const result = getMessageURL({})
        expect(result).toBe('/')
    })
})


describe('joinURLQueryString', () => {
    test.each<[ Record<string, string | number | bigint | boolean | null | undefined>, string ]>([
        [ {}, '' ],
        [ { aaa: undefined }, '' ],
        [ { aaa: '111', bbb: 222, ccc: null, ddd: true }, '?aaa=111&bbb=222&ccc=null&ddd=true' ],
        [ { aaa: false, bbb: undefined, ccc: BigInt('333') }, '?aaa=false&ccc=333' ],
    ])('joins url params', (params, joined) => {
        const result = joinURLQueryString(params)
        expect(result).toBe(joined)
    })
})


describe('parseURLQueryString', () => {
    test.each([
        [ '/', {} ],
        [ '/aaa/bbb/ccc', {} ],
        [ '/aaa/bbb/ccc/', {} ],
        [ '/#', {} ],
        [ '/aaa/bbb/ccc#', {} ],
        [ '/aaa/bbb/ccc/#', {} ],
        [ '/?', {} ],
        [ '/aaa/bbb/ccc?', {} ],
        [ '/aaa/bbb/ccc/?', {} ],
        [ '/?#', {} ],
        [ '/aaa/bbb/ccc?#', {} ],
        [ '/aaa/bbb/ccc/?#', {} ],
        [ '/?aaa=bbb', { aaa: 'bbb' } ],
        [ '/?aaa=bbb#', { aaa: 'bbb' } ],
        [ '/?aaa=bbb&ccc=ddd', { aaa: 'bbb', ccc: 'ddd' } ],
        [ '/?aaa=bbb&ccc=ddd#', { aaa: 'bbb', ccc: 'ddd' } ],
        [ '/?%20aaa%20=%20bbb%20', { ' aaa ': ' bbb ' } ],
        // no arrays, last value should take precedence
        [ '/?aaa=bbb&aaa=ccc', { aaa: 'ccc' } ],
        // again no arrays so no special php-style syntax
        [ '/?aaa[]=bbb&aaa[]=ccc', { 'aaa[]': 'ccc' } ],
        // ? and & should interchangeable even though it's technically
        // incorrect, just to keep shit from exploding
        [ '/?aaa=bbb?ccc=ddd', { aaa: 'bbb', ccc: 'ddd' } ],
        [ '/&aaa=bbb&ccc=ddd', { aaa: 'bbb', ccc: 'ddd' } ],
        [ '/?aaa&bbb=ccc&ddd', { bbb: 'ccc' } ],
        [ '/?aaa=&bbb=ccc&ddd=', { bbb: 'ccc' } ],
        [ '/?aaa&bbb=ccc&ddd#', { bbb: 'ccc' } ],
        [ '/?aaa=&bbb=ccc&ddd=#', { bbb: 'ccc' } ]
    ])('returns record with empty and missing values skipped and rest decoded', (url, query) => {
        let result = parseURLQueryString(url)
        expect(result).toEqual(query)
        result = new URLParser(url).query()
        expect(result).toEqual(query)
    })
})


describe('parseURLHash', () => {
    test.each([
        [ '/', '' ],
        [ '/?', '' ],
        [ '/#', '' ],
        [ '/?#', ''  ],
        [ '/?aaa=bbb#', '' ],
        [ '/#test', 'test' ],
        [ '/?#test', 'test'  ],
        [ '/?aaa=bbb#test', 'test' ],
        [ '/#%20test%20', ' test ' ]
    ])('returns decoded hash', (url, hash) => {
        let result = parseURLHash(url)
        expect(result).toBe(hash)
        result = new URLParser(url).hash()
        expect(result).toBe(hash)
    })
})


describe('parseURLPath', () => {
    const base: [ string, string ][] = [
        [ '', '/' ],
        [ '/', '/' ],
        [ '//', '/' ],
        [ '/aaa/bbb/ccc', '/aaa/bbb/ccc' ],
        [ '/aaa/bbb/ccc/', '/aaa/bbb/ccc' ],
        [ '//aaa/bbb///ccc', '/aaa/bbb/ccc' ],
        [ '//aaa/bbb///ccc////', '/aaa/bbb/ccc' ],
        [ '/%20aaa%20/%20bbb%20', '/ aaa / bbb ' ],
    ]

    test.each([
        ...base,
        ...base.map<[ string, string ]>(([ url, path ]) => [ url + '?aaa=bbb', path ]),
        ...base.map<[ string, string ]>(([ url, path ]) => [ url + '#aaa', path ]),
        ...base.map<[ string, string ]>(([ url, path ]) => [ url + '?aaa=bbb#aaa', path ])
    ])('returns decoded path and ignores query and hash', (url, path) => {
        let result = parseURLPath(url)
        expect(result).toBe(path)
        result = new URLParser(url).path()
        expect(result).toBe(path)
    })
})


describe('parseURLPathSegments', () => {
    const base: [ string, string[] ][] = [
        [ '', [] ],
        [ '/', [] ],
        [ '//', [] ],
        [ '/aaa/bbb/ccc', [ 'aaa', 'bbb', 'ccc' ] ],
        [ '/aaa/bbb/ccc/', [ 'aaa', 'bbb', 'ccc' ] ],
        [ '//aaa/bbb///ccc', [ 'aaa', 'bbb', 'ccc' ] ],
        [ '//aaa/bbb///ccc////', [ 'aaa', 'bbb', 'ccc' ] ],
        [ '/%20aaa%20/%20bbb%20', [ ' aaa ', ' bbb ' ] ],
    ]

    test.each([
        ...base,
        ...base.map<[ string, string[] ]>(([ url, path ]) => [ url + '?aaa=bbb', path ]),
        ...base.map<[ string, string[] ]>(([ url, path ]) => [ url + '#aaa', path ]),
        ...base.map<[ string, string[] ]>(([ url, path ]) => [ url + '?aaa=bbb#aaa', path ])
    ])('returns decoded path segments and ignores query and hash', (url, path) => {
        let result: ReadonlyArray<string> = [ ...parseURLPathSegments(url) ]
        expect(result).toEqual(path)
        result = new URLParser(url).segments()
        expect(result).toEqual(path)
    })
})


describe('parseContentTypeHeader', () => {
    test.each([
        '',
        ' '
    ])('returns undefined when header empty', header => {
        const result = parseContentTypeHeader(header)
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
    ])('returns parsed mheader', (header, contentType) => {
        const result = parseContentTypeHeader(header)
        expect(result?.type).toBe(contentType.type)
        expect(result?.characterSet).toBe(contentType.characterSet)
    })
})


describe('parseMessageContentType', () => {
    test('returns undefined when no content-type header', () => {
        const result = parseMessageContentType({ headers: {} })
        expect(result).toBeUndefined()
    })

    test.each([
        '',
        ' '
    ])('returns undefined when content-type header empty', header => {
        const result = parseMessageContentType({
            headers: { 'content-type': header }
        })
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
    ])('returns parsed content-type header', (header, contentType) => {
        const result = parseMessageContentType({
            headers: { 'content-type': header }
        })
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


describe('parseMessageContentLength', () => {
    test('returns undefined when header missing', () => {
        const result = parseMessageContentLength({ headers: {} })
        expect(result).toBeUndefined()
    })

    test.each([ '', ' ', 'test', '1.1' ])('returns undefined when header not an integer', header => {
        const result = parseMessageContentLength({
            headers: { 'content-length': header }
        })
        expect(result).toBeUndefined()
    })

    test.each([ '1', ' 2 ' ])('returns parsed integer', header => {
        const result = parseMessageContentLength({
            headers: { 'content-length': header }
        })
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


describe('parseMessageAuthorizationHeaderBearer', () => {
    test('returns missing when header missing', () => {
        const result = parseMessageAuthorizationHeaderBearer({ headers: {} })
        expect(result).toEqual(error('Missing'))
    })

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
    ])('returns invalid when header invalid', header => {
        const result = parseMessageAuthorizationHeaderBearer({
            headers: { authorization: header }
        })
        expect(result).toEqual(error('Invalid'))
    })

    test('returns parsed value', () => {
        const result = parseMessageAuthorizationHeaderBearer({
            headers: { authorization: 'Bearer Test1-._~+/' }
        })
        expect(result).toEqual(ok('Test1-._~+/'))
    })
})


describe('messageIsWebSocketRequest', () => {
    test.each([
        'upgrade',
        'Upgrade'
    ])('returns true when connection header is upgrade and upgrade header is websocket', header => {
        const result = messageIsWebSocketRequest({
            headers: {
                connection: header,
                upgrade: 'websocket'
            }
        })
        expect(result).toBe(true)
    })

    test.each([
        undefined,
        'test'
    ])('returns false when connection header missing or not upgrade', header => {
        const result = messageIsWebSocketRequest({
            headers: {
                connection: header,
                upgrade: 'websocket'
            }
        })
        expect(result).toBe(false)
    })

    test.each([
        'test',
        undefined
    ])('returns false when upgrade header missing or non-websocket', header => {
        const result = messageIsWebSocketRequest({
            headers: {
                connection: 'upgrade',
                upgrade: header
            }
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
