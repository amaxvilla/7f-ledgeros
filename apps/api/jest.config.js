module.exports = {
  rootDir: '.',

  moduleFileExtensions: ['js', 'json', 'ts'],

  testRegex: '.*\\.spec\\.ts$',

  transform: {
    '^.+\\.(t|j)s$': require.resolve('ts-jest'),
  },

  transformIgnorePatterns: [
    '/node_modules/\\.pnpm/(?!(?:@otplib\\+|@scure\\+|@noble\\+|otplib@))',
  ],

  testPathIgnorePatterns: [
    '/node_modules/',
    '/src-backup-before-ts-fix/',
  ],

  modulePathIgnorePatterns: [
    '/src-backup-before-ts-fix/',
  ],

  collectCoverageFrom: [
    'src/**/*.(t|j)s',
  ],

  coverageDirectory: './coverage',

  testEnvironment: 'node',
};
