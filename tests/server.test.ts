import {
    defaultErrorHandler,
    defaultResponseHandler
} from '../src/server'


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
    test.todo('messageHandler called with request')

    test.todo('responseHandler called with state from messageHandler')

    test.todo('cleanup called with response from responseHandler')

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
