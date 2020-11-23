import type { IncomingHttpHeaders } from 'http'

import { Cookie, ParsedContentType, ParsedURLPath } from '../src/types'
import {
    getMessageHeader,
    parseMessageContentLength,
    parseMessageContentType,
    parseMessageURL
} from '../src/utils'


describe('getMessageCookie', () => {
    test.todo('returns undefined when cookie header missing')

    test.todo('returns undefined when base64 encoded name missing from cookie header')

    test.todo('returns value base64 decoded')
})


describe('getMessageSignedCookie', () => {
    test.todo('returns undefined when cookie header missing')

    test.todo('returns undefined when base64 encoded signature name missing from cookie header')

    test.todo('returns undefined when base64 encoded name missing from cookie header')

    test.todo('returns undefined when signature does not match')

    test.todo('returns value base64 decoded')
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
    test.todo('returns connection remote address when useXForwardedFor false')

    test.todo('returns socket remote address when useXForwardedFor false and connection remote address undefined')

    test.todo('returns first entry of x-forwarded-for header when useXForwardedFor true')

    test.todo('returns connection remote address when x-forwarded-for header invalid')

    test.todo('returns socket remote address when x-forwarded-for header invalid and connection remote address undefined')
})


describe('getMessageMethod', () => {
    test.todo('returns uppercase method or GET if missing')
})


describe('getMessageURL', () => {
    test.todo("returns URL or '/' if missing")
})


describe('parseMessageURL', () => {
    function * getParsedURLs(): Generator<[ string, ParsedURLPath ]> {
        type PathPair = [ string, string[] ]
        const paths: PathPair[]  = [
            [ '/', [] ],
            [ '//', [] ],
            [ '/aaa/bbb/ccc', [ 'aaa', 'bbb', 'ccc' ] ],
            [ '/aaa/bbb/ccc/', [ 'aaa', 'bbb', 'ccc' ] ],
            [ '/aaa//bbb///ccc', [ 'aaa', 'bbb', 'ccc' ] ],
            [ '/aaa%20bbb', [ 'aaa bbb' ] ],
            [ '/%20aaa%20/', [ ' aaa ' ] ],
        ]

        type QueryPair = [ string, Record<string, string> ]
        const queries: QueryPair[] = [
            [ '', {} ],
            [ '?ddd=eee', { ddd: 'eee' } ],
            [ '?ddd=eee&fff=ggg', { ddd: 'eee', fff: 'ggg' } ],
            [ '?ddd=eee&ddd=fff', { ddd: 'fff' } ],
            [ '?ddd[]=eee&ddd[]=fff', { 'ddd[]': 'fff' } ],
            [ '?ddd%20eee=fff%20ggg', { 'ddd eee': 'fff ggg' } ],
            [ '?%20ddd%20=%20fff%20', { ' ddd ': ' fff ' } ],
        ]

        type HashPair = [ string, string ]
        const hashes: HashPair[] = [
            [ '', '' ],
            [ '#hhh', 'hhh' ],
            [ '#hhh%20iii', 'hhh iii' ],
            [ '#%20hhh%20', ' hhh ' ]
        ]

        // from https://stackoverflow.com/a/36234242/3289208
        const cartesian = (...arr: any[]): any[] =>
            arr.reduce(
                (a: any, b: any) =>
                    a.map((x: any) => b.map((y: any) => x.concat([ y ])))
                        .reduce((a: any, b: any) => a.concat(b), []),
                [[]]
            )
        const combinations: [ PathPair, QueryPair, HashPair ][] = cartesian(paths, queries, hashes)

        for (const [ [ path, parsedPath ], [ query, parsedQuery ], [ hash, parsedHash ] ] of combinations) {
            const url = path + query + hash
            const parsed: ParsedURLPath = {
                path: parsedPath,
                query: parsedQuery,
                hash: parsedHash
            }
            yield [ url, parsed ]
        }
    }

    test.each([ ...getParsedURLs() ])('parses url', (url, parsed) => {
        const result = parseMessageURL({ url })
        expect(result).toEqual(parsed)
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


describe('cookieToHeader', () => {
    test.each<[ Cookie, string ]>([

    ])('returns name and values based64 encoded with properties joined', () => {

    })
})


describe('cookieToSignedHeaders', () => {
    test.each<[ Cookie, string, string, string ]>([

    ])('returns cookie header and signature header signed with key', () => {

    })
})
