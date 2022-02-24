export default {
    testRegex: '\\.test\\.tsx?$',
    moduleNameMapper: {
        '^(.*)\\.js$': '$1'
    },
    setupFilesAfterEnv: [ 'jest-extended/all' ]
}
