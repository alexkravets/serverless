'use strict';

import * as fs from 'fs';
import { S3Client } from '@aws-sdk/client-s3';
import uploadZip from './uploadZip';

jest.mock('fs');
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn() };
});

let mockSend: jest.Mock;

beforeEach(() => {
  mockSend = jest.fn().mockResolvedValue({});
  jest.mocked(S3Client).mockImplementation(() => ({ send: mockSend }) as unknown as S3Client);
  jest.mocked(fs.createReadStream).mockReturnValue('stream' as unknown as fs.ReadStream);
  jest.mocked(fs.unlinkSync).mockReturnValue(undefined);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('uploadZip()', () => {
  it('uploads the zip to S3, then cleans up locally', async () => {
    const s3 = new S3Client({});
    const bucket = 'deploy-bucket';
    const zipPath = '/tmp/app.zip';

    const key = await uploadZip(s3, bucket, zipPath);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(key).toMatch(/^\d+\.zip$/);

    const command = mockSend.mock.calls[0][0];
    expect(command.input.Bucket).toBe(bucket);

    expect(fs.createReadStream).toHaveBeenCalledWith(zipPath);
    expect(fs.unlinkSync).toHaveBeenCalledWith(zipPath);
  });
});
