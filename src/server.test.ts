import 'jest-extended'


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
    test.todo('handlers called in order with message, sockets and each successive state')

    test.todo('cleanup calls handler cleanups in reverse order')
})


describe('composeResultMessageHandlers', () => {
    test.todo('handlers called in order with message, sockets and each successive state')

    test.todo('cleanup calls handler cleanups in reverse order')
})


describe('fallthroughMessageHandler', () => {
    test.todo("calls handlers in order and returns first response that doesn't match isNext func")

    test.todo("returns response with noMatch parameter as state if all handlers' responses match isNext")
})
