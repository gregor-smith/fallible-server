import WebSocketConstants from 'ws/lib/constants.js'


export const EMPTY_BUFFER = WebSocketConstants.EMPTY_BUFFER
export const WEBSOCKET_GUID = WebSocketConstants.GUID
/** 10MB */
export const WEBSOCKET_DEFAULT_MAXIMUM_MESSAGE_SIZE = 10 * 1024 * 1024
export const WEBSOCKET_RAW_RESPONSE_BASE = 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
