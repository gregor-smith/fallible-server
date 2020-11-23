import type { IncomingHttpHeaders } from 'http'

import { Request, RequestArguments, Method, ParsedContentType, ParsedURL } from '../src'


function createRequest({
    url = '/',
    behindProxy = false,
    getCookie = jest.fn(),
    method = 'GET',
    headers = {}
}: Partial<RequestArguments> = {}): [ request: Request, getCookie: typeof getCookie ] {
    const request = new Request({
        url,
        behindProxy,
        getCookie,
        method,
        headers
    })
    return [ request, getCookie ]
}


test('cookie method', () => {
    const [ request, mock ] = createRequest()
    expect(request.cookie).toBe(mock)
    request.cookie('test')
    expect(mock).toHaveBeenCalledTimes(1)
    expect(mock).toHaveBeenCalledWith('test')
})


test.each<Method>([ 'GET', 'POST', 'DELETE' ])('method field', method => {
    const [ request ] = createRequest({ method })
    expect(request.method).toBe(method)
})


test.each<IncomingHttpHeaders>([ {}, { 'content-type': 'test' } ])('headers field', headers => {
    const [ request ] = createRequest({ headers })
    expect(request.headers).toBe(headers)
})


test.each<string>([ '/', '/test' ])('url field', url => {
    const [ request ] = createRequest({ url })
    expect(request.url).toBe(url)
})


test.each<IncomingHttpHeaders>([ {}, { 'content-type': 'test' } ])('header method', headers => {
    const [ request ] = createRequest({ headers })
    expect(request.header('content-type')).toBe(headers['content-type'])
})


describe('parsedContentType fields', () => {
    test('returns undefined when no content-type header', () => {
        const [ request ] = createRequest()
        expect(request.parsedContentType).toBeUndefined()
        expect(request.contentType).toBeUndefined()
        expect(request.characterSet).toBeUndefined()
    })

    test.each<string>([ '', ' ' ])('returns undefined when content-type header empty', header => {
        const [ request ] = createRequest({ headers: { 'content-type': header } })
        expect(request.parsedContentType).toBeUndefined()
        expect(request.contentType).toBeUndefined()
        expect(request.characterSet).toBeUndefined()
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
    ])('parses content-type header', (header, contentType) => {
        const [ request ] = createRequest({ headers: { 'content-type': header } })
        expect(request.parsedContentType?.type).toBe(contentType.type)
        expect(request.contentType).toBe(contentType.type)
        expect(request.parsedContentType?.characterSet).toBe(contentType.characterSet)
        expect(request.characterSet).toBe(contentType.characterSet)
    })
})


function * getParsedURLs(): Generator<[ string, ParsedURL ]> {
    const paths: [ string, string[] ][]  = [
        [ '/', [] ],
        [ '//', [] ],
        [ '/aaa/bbb/ccc', [ 'aaa', 'bbb', 'ccc' ] ],
        [ '/aaa/bbb/ccc/', [ 'aaa', 'bbb', 'ccc' ] ],
        [ '/aaa//bbb///ccc', [ 'aaa', 'bbb', 'ccc' ] ],
        [ '/aaa%20bbb', [ 'aaa bbb' ] ],
        [ '/%20aaa%20/', [ ' aaa ' ] ],
    ]
    const queries: [ string, Record<string, string> ][] = [
        [ '', {} ],
        [ '?ddd=eee', { ddd: 'eee' } ],
        [ '?ddd=eee&fff=ggg', { ddd: 'eee', fff: 'ggg' } ],
        [ '?ddd=eee&ddd=fff', { ddd: 'fff' } ],
        [ '?ddd[]=eee&ddd[]=fff', { 'ddd[]': 'fff' } ],
        [ '?ddd%20eee=fff%20ggg', { 'ddd eee': 'fff ggg' } ],
        [ '?%20ddd%20=%20fff%20', { ' ddd ': ' fff ' } ],
    ]
    const hashes: [ string, string ][] = [
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
    type Combination = [
        [ string, string[] ],
        [ string, Record<string, string> ],
        [ string, string ]
    ]
    const combinations: Combination[] = cartesian(paths, queries, hashes)

    for (const [ [ path, parsedPath ], [ query, parsedQuery ], [ hash, parsedHash ] ] of combinations) {
        const url = path + query + hash
        const parsed: ParsedURL = {
            path: parsedPath,
            query: parsedQuery,
            hash: parsedHash
        }
        yield [ url, parsed ]
    }
}


test.each([ ...getParsedURLs() ])('parsedURL fields', (url, parsed) => {
    const [ request ] = createRequest({ url })
    expect(request.parsedURL).toEqual(parsed)
    expect(request.path).toEqual(parsed.path)
    expect(request.query).toEqual(parsed.query)
    expect(request.hash).toBe(parsed.hash)
})
