import { error, ok, Result } from 'fallible'

import type { MessageHandler } from './types'
import { getMessageHeader } from './utils'


export type AuthorisationTokenState = {
    authorisationToken: Result<string, 'HeaderMissing' | 'HeaderInvalid'>
}


export function parseAuthorisationBearer<State, Error>(): MessageHandler<State, AuthorisationTokenState, Error> {
    return (message, state) => {
        let authorisationToken: AuthorisationTokenState['authorisationToken']
        const header = getMessageHeader(message, 'Authorization')
        if (header === undefined) {
            authorisationToken = error('HeaderMissing')
        }
        else {
            const token = header.match(/^Bearer (.+)/)?.[1]
            authorisationToken = token === undefined
                ? error('HeaderInvalid')
                : ok(token)
        }
        return ok({
            state: {
                ...state,
                authorisationToken
            }
        })
    }
}
