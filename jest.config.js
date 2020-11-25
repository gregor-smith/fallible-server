module.exports = {
    testRegex: '\\.test\\.ts$',
    preset: 'ts-jest',
    testEnvironment: 'node',
    setupFilesAfterEnv: [ 'jest-extended' ],
    globals: {
        'ts-jest': {
            tsconfig: 'tsconfig.esm.json'
        }
    }
}
