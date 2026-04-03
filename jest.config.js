'use strict';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        strict:           true,
        esModuleInterop:  true,
        types:            ['jest'],
      },
    }],
  },
  coverageReporters: [['text', { skipFull: true }]],
};
