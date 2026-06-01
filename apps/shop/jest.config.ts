import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@ddcar/db$': '<rootDir>/../../packages/db/src/index.ts',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
}

export default config
