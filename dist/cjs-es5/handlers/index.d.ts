import { Result } from 'fallible';
import type { MessageHandler } from '../types';
export declare type AuthorisationTokenState = {
    authorisationToken: Result<string, 'HeaderMissing' | 'HeaderInvalid'>;
};
export declare function parseAuthorisationBearer<State, Error>(): MessageHandler<State, AuthorisationTokenState, Error>;
export declare type GetWebSocketState = {
    isWebSocket: boolean;
};
export declare function getIsWebSocket<State, Error>(): MessageHandler<State, GetWebSocketState, Error>;
