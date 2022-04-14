# `fallible-server`
A Node Web framework with a focus on type safety and cleaner error handling. 

**Currently a work in progress and subject to change**.

## Features
* Type-safe middleware-like composition
* First class WebSocket support
* Utils for parsing request bodies and common headers - no magic, just functions.

## Installation
No NPM package for now, so just install from this repository. You'll probably want `fallible` too:

```sh
yarn add https://github.com/gregor-smith/fallible-server.git#v0.2.0 https://github.com/gregor-smith/fallible.git#v1.0.0
```

## Message handlers
The core of this package is the `createRequestListener` function, which returns a callback used to listen to the `request` event on Node's `http.Server` and other similar APIs.

This function takes a `MessageHandler`, which is a function taking a Node `IncomingMessage` and producing a `MessageHandlerResult`. In its simplest form an application would look something like this:

```typescript
const [ requestListener ] = createRequestListener(message =>
    response({
        body: `${message.method} ${message.url}`,
        headers: new Headers({
            'Content-Type': 'text/plain; charset=utf-8'
        })
    })
)

http.createServer(requestListener)
    .listen(5000, 'localhost')
```

While the function passed to `createRequestListener` must return a `MessageHandlerResult<Response>`, `MessageHandler`s can in fact return any arbitrary state, and also take any arbitrary state, which is passed to its second parameter.

An example of a typical reusable handler can be found below. This handler connects to a database and returns the connection as part of a new state. Note that a particular existing state is required, and also that it returns a cleanup function to close the database when the response is completed.

```typescript
type RequiredState = {
    config: {
        databaseURI: string
    }
}

type NewState = {
    database: Result<Database, DatabaseError>
}

async function connectDatabaseHandler<RequiredState extends RequiredState>(
    message: IncomingMessage,
    state: RequiredState
): Promise<MessageHandlerResult<RequiredState & NewState>> {
    const databaseResult = await connectDatabase(state.config.databaseURI)
    if (!databaseResult.ok) {
        console.error(`Error connecting to database: ${databaseResult.value}`)
    }
    return response(
        {
            ...state,
            database: databaseResult
        },
        async () => {
            const closeResult = await closeDatabase(database)
            if (!closeResult.ok) {
                console.error(`Error closing database: ${closeResult.value}`)
            }
        }
    )
}
```

The above handler is not very useful on its own, but if chained with a preceding handler to provide the required state and a succeeding handler to turn the returned state into a `Response`, it could be. Such composition is done using the `composeMessageHandlers` function:

```typescript
declare const handlerA: MessageHandler<StateA, StateB>
declare const handlerB: MessageHandler<StateB, StateC>

// Swap the arguments around and it's a compile error
const chained: MessageHandler<StateA, StateC> = composeMessageHandlers(handlerA, handlerB)
```

Handlers returning `fallible` `Result`s can be chained using `composeResultMessageHandlers`. If the first handler returns an `Error` state, it is immediately returned. If it returns an `Ok` state, its value is passed as the state to the second handler. As with `composeMessageHandlers`, any cleanup functions returned are combined so that the second handler's cleanup is called before the first's:

```typescript
declare const handlerA: MessageHandler<StateA, Result<StateB, ErrorA>>
declare const handlerB: MessageHandler<StateB, Result<StateC, ErrorB>>

const chained: MessageHandler<StateA, Result<StateC, ErrorA | ErrorB>> = composeResultMessageHandlers(handlerA, handlerB)
```

The `MessageHandlerComposer` and `ResultMessageHandlerComposer` classes offer a more elegant alternative when chaining many handlers at once:

```typescript
let chained = new ResultMessageHandlerComposer(a)
    .intoResultHandler(b)
    .intoHandler(c)
    .build()

// Equivalent to:
chained = composeMessageHandlers(composeResultMessageHandlers(a, b), c)
```

Note that there is no requirement to use any of these composition functions, nor to have multiple handlers at all. It is entirely possible to define all logic in a single handler and pass that to `createRequestListener`, and for small applications this may be a perfectly suitable solution.

## Responses
### Regular responses
Various types of body can be returned as part of regular non-WebSocket responses. These are:

* `Uint8Array`s. Note that `Buffer` is a subtype.
* `string`s, which are always treated as `utf-8`. If you require another encoding, return a `Buffer` instead.
* `StreamBody`. This is anything implementing `Iterable<Uint8Array>` or `AsyncIterable<Uint8Array>`, or a function returning such an object. Node that this includes Node streams, such as those returned by `fs.createReadStream`.
* `undefined`, for a bodiless response.

The `Content-Type` and `Content-Length` headers may be set by default depending on the type of this body:

| Body type    | `Content-Type`             | `Content-Length`        |
|--------------|----------------------------|-------------------------|
| `string`     | `text/html; charset=utf-8` | Value's length in bytes |
| `Uint8Array` | `application/octet-stream` | Value's length in bytes |
| `StreamBody` | `application/octet-stream` | Not set                 |
| `undefined`  | Not set                    | `0`                     |

Setting headers through the `headers` field of the response will always override any defaults. Additionally, setting the `status` field will always override the default of `200`.
The `headers` field should be a web standard [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) object or a polyfill thereof. Validation of keys and sanitisation of values are left to the user (note that `Headers` does this automatically).

### WebSocket responses
A WebSocket response is made up of various callbacks. Although none are technically required, typically you'll use all of them. These are:

#### `onOpen`
Called when the socket connects. Should return an awaitable iterator yielding `string`s or `Buffer`s to be sent as messages, and optionally returning a `WebSocketCloseInfo` object which is used to close the WebSocket if required.

#### `onMessage`
Called with the data of each message the socket receives. Returns the same kind of iterator as `onOpen`.

#### `onClose`
When the socket closes, this callback is called with the code and reason. Can optionally return a `Promise`.

#### `onSendError`
Whenever sending a message fails for any reason, this callback is called with the data being sent and the error thrown. Can optionally return a `Promise`.

All of these callbacks also receive a UUID generated for the socket, which as shown in the next section can be used to manipulate sockets outwith the context of a `MessageHandler`. If you really need to, you can override this UUID with the `uuid` field of the response.

WebSocket responses require an `accept` field, which is used for the `Sec-WebSocket-Accept` header. An optional `protocol` field is used for the `Sec-WebSocket-Protocol` header. A convenience `WebSocketResponder` class is provided to parse these fields from an `IncomingMessage`, returning a `Result` covering every potential error. Its `response` method can then be used to simplify creating a `WebSocketResponse`:

```typescript
function exampleWebSocketHandler(message: IncomingMessage): MessageHandlerResult {
    const result = WebSocketResponder.fromHeaders(message.method, message.headers)
    if (!result.ok) {
        const error = result.value
        switch (error.tag) {
            /* Obviously in a real application your responses 
               should ideally be a little more detailed! */
            case 'NonGETMethod':
                return response({ status: 405 })
            case 'MissingUpgradeHeader':
                return response({ status: 426 })
            case 'InvalidUpgradeHeader':
            case 'MissingVersionHeader':
            case 'InvalidOrUnsupportedVersionHeader':
            case 'MissingKeyHeader':
            case 'InvalidKeyHeader':
                return response({ status: 400 })
        }
    }
    const webSocketResponder = result.value
    return webSocketResponder.response({ 
        * onOpen() {
            yield 'Hello!'
        }
    })
}
```

Additional headers can be set through the `headers` field, just like with regular responses. `Connection`, `Upgrade`, `Sec-WebSocket-Accept` and `Sec-WebSocket-Protocol` headers should not be set; doing so will print a warning.

## Managing connected WebSockets
In addition to their request and state parameters, `MessageHandler` functions receive a third parameter, which is a readonly `Map` of all connected WebSockets identified by their UUIDs. This can be used to close or send messages through a WebSocket from a handler other than the one that created it.

This same map is the second item in the tuple returned by `createRequestListener`, allowing sockets to be manipulated entirely outwith the context of a request.

```typescript
const [ requestListener, sockets ] = createRequestListener((_message, _state, sockets) =>
    webSocketResponse({
        * onOpen(socketUUID) {
            for (const [ uuid, socket ] of sockets.entries()) {
                if (uuid === socketUUID || socket.readyState !== WebSocketReadyState.Open) {
                    continue
                }
                // This returns a Promise, but in most cases you won't want to await it
                socket.send(`Hello ${uuid}, from ${socketUUID}`)
            }
        }
    })
)

http.createServer(requestListener)
    .listen(5000, 'localhost')

setInterval(
    () => {
        for (const [ uuid, socket ] of sockets.entries()) {
            if (socket.readyState !== WebSocketReadyState.Open) {
                continue
            }
            socket.send(`Hello ${uuid}, glad you're still connected`)
        }
    },
    5000
)
```

In the future the socket map may be extended to emit events when sockets connect and close and such.

## Exception handling
My motivation behind this project was a desire for a Node web server with cleaner, more type-safe error handling, hence the integration with `fallible` and derivative name. As such, `MessageHandler`s should **never** throw, nor their `Cleanup` functions, nor any of the `WebSocketBody` callbacks, nor anything else. Anything that you suspect may throw should be wrapped to return a `Result` instead using the utilities `fallible` provides.

That said, this is ultimately still Node, and Node is never truly exception-free. For this reason, `createRequestListener` has a second `exceptionListener` parameter which is called if the `messageHandler` parameter throws or if an `error` event is fired while the response is being written. This parameter should always be set; not doing so will print a warning and fall back to `console.error`.

If the `MessageHandler` passed to `createRequestListener` throws, an empty response with a status of `500` will be written. If this is a problem, strive to eliminate exceptions from your handlers.

## Routing
Currently no dedicated router is included with this package, but there are tools with which you can easily make your own, notably `fallthroughMessageHandler`.

This function takes an array of `MessageHandlers` which may return either some arbitrary response state or a specific state indicating that execution should fall through to the next handler in the array. In case every handler falls through, a given fallback handler is used. A given type guard is used to identify the state returned by each handler. An example of this can be seen below; note that neither return state is required to take any specific shape.

```typescript
const routeHandlers: MessageHandler<void, Response | 'no-match'>[] = [
    someRouteHandler,
    someOtherRouteHandler,
    // ...etc
]

function notFoundHandler(): MessageHandlerResult {
    return response({
        status: 404,
        body: '404 not found'
    })
}

// Just an example - the fallthrough state can be any arbitrary type
function isNoMatch<T>(state: T | 'no-match'): state is 'no-match' {
    return state === 'no-match'
}

const routerHandler: MessageHandler<void, Response> = fallthroughMessageHandler(
    routeHandlers,
    notFoundHandler,
    isNoMatch
)
```

## Utilities
A number of utility functions to help with common web application problems are included, such as:

* `parseCharSetContentTypeHeader`, `parseContentLengthHeader` and `parseAuthorizationHeaderBearer` for common header parsing
* `getMessageIP`, which gets the IP of the client a message represents, optionally respecting the `X-Forwarded-For` header
* `parseJSONStream`, which parses a request's JSON body with an optional size limit
* `parseMultipartRequest`, which parses a request's `multipart/form-data` body. Many optional limits on field and file sizes; see the function signature. Currently backed by `formidable`, which will likely change in future versions.

If you wish to use any of these utilities in the browser for whatever reason, import directly from `fallible-server/utils` rather than `fallible-server`. The only function that explicitly requires a Node environment is `parseMultipartRequest`, which is why it is found under `fallible-server/server`.
