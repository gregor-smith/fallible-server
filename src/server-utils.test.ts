describe('parseJSONStream', () => {
    test.todo('returns MaximumSizeExceeded when stream larger than maximumSize param')

    test.todo('returns DecodeError when stream buffer cannot be decoded')

    test.todo('returns InvalidSyntax when JSON cannot be parsed')

    test.todo('returns JSON decoded with given charset')
})


describe('parseMultipartRequest', () => {
    test.todo('returns InvalidMultipartContentTypeHeader when content type header invalid')

    test.todo('returns RequestAborted when request aborted during parsing')

    test.todo('returns BelowMinimumFileSize when individual file size lower than minimumFileSize param')

    test.todo('returns MaximumFileCountExceeded when more files than maximumFileCount param')

    test.todo('returns MaximumFileSizeExceeded when individual file size larger than maximumFileSize param')

    test.todo('returns MaximumTotalFileSizeExceeded when combined file size larger than maximumFileSize param * maximumFileCount param')

    test.todo('returns MaximumFieldsCountExceeded when more fields than maximumFieldsCount param')

    test.todo('returns MaximumFieldsSizeExceeded when combined fields larger than maximumFieldsSize param')

    test.todo('returns UnknownError when parsing raises unknown exception')

    test.todo('returns files and fields decoded with given charset')

    test.todo('keepFileExtensions param adds file extensions to returned paths')

    test.todo('saveDirectory param changes returned file paths')
})
