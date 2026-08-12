module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // otplib v13 (see security-hardening/mfa.service.ts) ships ESM-only
  // internals (@otplib/*, @scure/base, @noble/hashes) that Jest's default
  // "ignore all of node_modules" transform setting can't run — without
  // this, any test that imports otplib fails at load time with a raw
  // SyntaxError on the first `export` statement inside that chain, not a
  // real assertion failure.
  transformIgnorePatterns: ['/node_modules/\\.pnpm/(?!(?:@otplib\\+|@scure\\+|@noble\\+|otplib@))'],
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
