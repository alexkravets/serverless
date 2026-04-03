'use strict';

import * as fs from 'fs';
import createTemplate from './createTemplate';

jest.mock('fs');
jest.mock('../build', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    Resources: {
      ApiFunction: {
        Properties: { Code: '.' },
      },
    },
    Outputs: {},
  }),
}));

beforeEach(() => {
  jest.mocked(fs.mkdirSync).mockReturnValue(undefined);
  jest.mocked(fs.writeFileSync).mockReturnValue(undefined);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('createTemplate()', () => {
  it('creates the serverless template with your Lambda code location', () => {
    const template = createTemplate({} as never, 'my-bucket', 'abc123.zip');
    const resources = template.Resources as Record<string, Record<string, Record<string, unknown>>>;
    expect(resources.ApiFunction.Properties.Code).toEqual({ S3Bucket: 'my-bucket', S3Key: 'abc123.zip' });

    expect(fs.mkdirSync).toHaveBeenCalledWith('.serverless', { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith('.serverless/template.yaml', expect.any(String));

    expect(template).toHaveProperty('Resources');
    expect(template).toHaveProperty('Outputs');
  });
});
