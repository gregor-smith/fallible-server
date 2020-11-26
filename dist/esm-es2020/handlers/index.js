import { error, ok } from 'fallible';
import { getMessageHeader } from '../utils';
export function parseAuthorisationBearer() {
    return (message, state) => {
        let authorisationToken;
        const header = getMessageHeader(message, 'Authorization');
        if (header === undefined) {
            authorisationToken = error('HeaderMissing');
        }
        else {
            const token = header.match(/^Bearer (.+)/)?.[1];
            authorisationToken = token === undefined
                ? error('HeaderInvalid')
                : ok(token);
        }
        return ok({
            state: {
                ...state,
                authorisationToken
            }
        });
    };
}
export function getIsWebSocket() {
    return (message, state) => ok({
        state: {
            ...state,
            isWebSocket: getMessageHeader(message, 'upgrade') === 'websocket'
        }
    });
}
//# sourceMappingURL=index.js.map