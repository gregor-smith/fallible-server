describe('parseJSONStream', () => {
    test.todo('returns TooLarge when stream larger than sizeLimit param')

    test.todo('returns OtherError when stream raises unknown exception')

    test.todo('returns InvalidSyntax when JSON cannot be decoded')

    test.todo('returns JSON decoded with given charset')
})


describe('parseMultipartStream', () => {
    test.todo('returns FilesTooLarge when file larger than fileSizeLimit param')

    test.todo('returns FieldsTooLarge when fields larger than fieldsSizeLimit param')

    test.todo('returns OtherError when stream raises unknown exception')

    test.todo('returns files and fields decoded with given charset')

    test.todo('keepFileExtensions param adds file extensions to paths')

    test.todo('saveDirectory param changes file paths')
})


describe('openFile', () => {
    test.todo('propagates error from stat call')

    test.todo('returns IsADirectory error before attempting to open')

    test.todo('propagates error from open call')

    test.todo('returns stats and stream of given path decoded with given charset')
})


describe('openSanitisedFile', () => {
    test.todo('propagates error from stat call')

    test.todo('returns IsADirectory error before attempting to open')

    test.todo('propagates error from open call')

    test.todo('returns stats and stream of given path decoded with given charset')

    test.todo('returns NoSuchFileOrDirectory when illegal filename given')
})
