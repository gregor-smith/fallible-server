import type { IncomingHttpHeaders } from 'http'
import Keygrip from 'keygrip'

import { Cookie, ParsedContentType } from '../src/types'
import {
    cookieHeader,
    signedCookieHeader,
    parseMessageCookie,
    getMessageHeader,
    getMessageIP,
    getMessageMethod,
    getMessageURL,
    parseMessageContentLength,
    parseMessageContentType,
    // parseURLPath,
    parseURLHash,
    parseURLQueryString,
    parseSignedMessageCookie,
    parseURLPath
} from '../src/utils'


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
    test('returns undefined when cookie header missing', () => {
        const result = parseSignedMessageCookie(
            { headers: {} },
            'test',
            new Keygrip([ 'test key' ])
        )
        expect(result).toBeUndefined()
    })

    test.each([
        'test',
        'test=value',
        'test=value; test2=value2; test3=value3'
    ])('returns undefined when signature name missing from cookie header', header => {
        const result = parseSignedMessageCookie(
            { headers: { cookie: header } },
            'test',
            new Keygrip([ 'test key' ])
        )
        expect(result).toBeUndefined()
    })

    test.each([
        'test',
        'test=value',
        'test=value; test2=value2; test3=value3'
    ])('returns undefined when name missing from cookie header', header => {
        const result = parseSignedMessageCookie(
            { headers: { cookie: header } },
            'test4',
            new Keygrip([ 'test key' ])
        )
        expect(result).toBeUndefined()
    })

    test.each([
        [ 'test=value; test.sig=ItukCx0lb6-dY71Zps-69Gkz5XE', 'test' ],
        [ 'test2=value2; test2.sig=JLS-pHsjhoJAExITxBFTj8jko5o', 'test2' ]
    ])('returns undefined when signature does not match', (header, name) => {
        const result = parseSignedMessageCookie(
            { headers: { cookie: header } },
            name,
            new Keygrip([ 'invalid key' ])
        )
        expect(result).toBeUndefined()
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
        expect(result).toBe(value)
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


describe('signedCookieHeader', () => {
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
        const result = signedCookieHeader(name, cookie, new Keygrip([ key ]))
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
    test('returns connection remote address when useXForwardedFor false', () => {
        const remoteAddress = 'test connection remote address'
        const result = getMessageIP({
            headers: {},
            connection: { remoteAddress },
            socket: {}
        })
        expect(result).toBe(remoteAddress)
    })

    test('returns socket remote address when useXForwardedFor false and connection remote address undefined', () => {
        const remoteAddress = 'test socket remote address'
        const result = getMessageIP({
            headers: {},
            connection: {},
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
            connection: {},
            socket: {}
        }, true)
        expect(result).toBe('test-x-forwarded-address')
    })

    test.each([
        '',
        ' ',
    ])('returns connection remote address when x-forwarded-for header invalid', header => {
        const remoteAddress = 'test connection remote address'
        const result = getMessageIP({
            headers: {
                'x-forwarded-for': header
            },
            connection: { remoteAddress },
            socket: {}
        }, true)
        expect(result).toBe(remoteAddress)
    })

    test.each([
        '',
        ' ',
    ])('returns socket remote address when x-forwarded-for header invalid and connection remote address undefined', header => {
        const remoteAddress = 'test socket remote address'
        const result = getMessageIP({
            headers: {
                'x-forwarded-for': header
            },
            connection: {},
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


// function getTestURLs() {
//     type ParsedURL = {
//         path: string[]
//         query: Partial<Record<string, string>>
//         hash: string
//     }

//     type PathTuple = [ string, ParsedURL['path'] ]
//     const paths: PathTuple[]  = [
//         [ '/', [] ],
//         [ '//', [] ],
//         [ '/aaa/bbb/ccc', [ 'aaa', 'bbb', 'ccc' ] ],
//         [ '/aaa/bbb/ccc/', [ 'aaa', 'bbb', 'ccc' ] ],
//         [ '/aaa//bbb///ccc', [ 'aaa', 'bbb', 'ccc' ] ],
//         [ '/aaa//bbb///ccc//', [ 'aaa', 'bbb', 'ccc' ] ],
//         [ '/aaa%20bbb', [ 'aaa bbb' ] ],
//         [ '/%20aaa%20/', [ ' aaa ' ] ],
//     ]

//     type QueryTuple = [ string, ParsedURL['query'] ]
//     const queries: QueryTuple[] = [
//         [ '', {} ],
//         [ '?ddd=eee', { ddd: 'eee' } ],
//         [ '?ddd=eee&fff=ggg', { ddd: 'eee', fff: 'ggg' } ],
//         [ '?ddd&eee=fff', { eee: 'fff' } ],
//         [ '?ddd=eee&ddd=fff', { ddd: 'fff' } ],
//         [ '?ddd[]=eee&ddd[]=fff', { 'ddd[]': 'fff' } ],
//         [ '?ddd%20eee=fff%20ggg', { 'ddd eee': 'fff ggg' } ],
//         [ '?%20ddd%20=%20fff%20', { ' ddd ': ' fff ' } ],
//     ]

//     type HashTuple = [ string, ParsedURL['hash'] ]
//     const hashes: HashTuple[] = [
//         [ '', '' ],
//         [ '#hhh', 'hhh' ],
//         [ '#hhh%20iii', 'hhh iii' ],
//         [ '#%20hhh%20', ' hhh ' ]
//     ]

//     return cartesian(paths, queries, hashes) as [ PathTuple, QueryTuple, HashTuple ][]
// }


describe('parseURLQueryString', () => {
    const shared: [ string, Record<string, string> ][] = [
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
        [ '/&aaa=bbb&ccc=ddd', { aaa: 'bbb', ccc: 'ddd' } ]
    ]

    test.each([
        ...shared,
        [ '/?aaa&bbb=ccc&ddd', { bbb: 'ccc' } ],
        [ '/?aaa=&bbb=ccc&ddd=', { bbb: 'ccc' } ],
        [ '/?aaa&bbb=ccc&ddd#', { bbb: 'ccc' } ],
        [ '/?aaa=&bbb=ccc&ddd=#', { bbb: 'ccc' } ]
    ])('returns record with empty and missing values skipped and rest decoded', (url, query) => {
        const result = parseURLQueryString(url)
        expect(result).toEqual(query)
    })

    test.each([
        ...shared,
        [ '/?aaa&bbb=ccc&ddd', { bbb: 'ccc' } ],
        [ '/?aaa=&bbb=ccc&ddd=', { aaa: '', bbb: 'ccc', ddd: '' } ],
        [ '/?aaa&bbb=ccc&ddd#', { bbb: 'ccc' } ],
        [ '/?aaa=&bbb=ccc&ddd=#', { aaa: '', bbb: 'ccc', ddd: '' } ]
    ])('empty values present when skipEmptyValues false', (url, query) => {
        const result = parseURLQueryString(url, { skipEmptyValues: false })
        expect(result).toEqual(query)
    })

    test.each([
        ...shared,
        [ '/?aaa&bbb=ccc&ddd', { aaa: '', bbb: 'ccc', ddd: '' } ],
        [ '/?aaa=&bbb=ccc&ddd=', { bbb: 'ccc' } ],
        [ '/?aaa&bbb=ccc&ddd#', { aaa: '', bbb: 'ccc', ddd: '' } ],
        [ '/?aaa=&bbb=ccc&ddd=#', { bbb: 'ccc' } ]
    ])('missing values present when skipMissingValues false', (url, query) => {
        const result = parseURLQueryString(url, { skipMissingValues: false })
        expect(result).toEqual(query)
    })

    test.each([
        ...shared,
        [ '/?aaa&bbb=ccc&ddd', { aaa: '', bbb: 'ccc', ddd: '' } ],
        [ '/?aaa=&bbb=ccc&ddd=', { aaa: '', bbb: 'ccc', ddd: '' } ],
        [ '/?aaa&bbb=ccc&ddd#', { aaa: '', bbb: 'ccc', ddd: '' } ],
        [ '/?aaa=&bbb=ccc&ddd=#', { aaa: '', bbb: 'ccc', ddd: '' } ]
    ])('empty and missing values present when skipEmptyValues and skipMissingValues false', (url, query) => {
        const result = parseURLQueryString(url, {
            skipEmptyValues: false,
            skipMissingValues: false
        })
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
        const result = parseURLHash(url)
        expect(result).toBe(hash)
    })
})


describe('parseURLPath', () => {
    const base: [ string, string[] ][] = [
        [ '/', [] ],
        [ '//', [] ],
        [ '/', [] ],
        [ '//', [] ],
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
    ])('returns decoded path and ignores query and hash', (url, path) => {
        const result = parseURLPath(url)
        expect(result).toEqual(path)
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
