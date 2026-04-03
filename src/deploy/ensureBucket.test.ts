'use strict';

import { S3Client } from '@aws-sdk/client-s3';
import ensureBucket from './ensureBucket';

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn() };
});

let mockSend: jest.Mock;

beforeEach(() => {
  mockSend = jest.fn();
  jest.mocked(S3Client).mockImplementation(() => ({ send: mockSend }) as unknown as S3Client);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('ensureBucket()', () => {
  it('does not create bucket when it already exists', async () => {
    mockSend.mockResolvedValueOnce({});
    const s3 = new S3Client({});
    await ensureBucket(s3, 'my-bucket', 'us-east-1');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('creates bucket when HeadBucket throws', async () => {
    mockSend
      .mockRejectedValueOnce(new Error('NotFound'))
      .mockResolvedValueOnce({});
    const s3 = new S3Client({});
    await ensureBucket(s3, 'my-bucket', 'us-east-1');
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('omits LocationConstraint for us-east-1', async () => {
    mockSend
      .mockRejectedValueOnce(new Error('NotFound'))
      .mockResolvedValueOnce({});
    const s3 = new S3Client({});
    await ensureBucket(s3, 'my-bucket', 'us-east-1');
    const createCommand = mockSend.mock.calls[1][0];
    expect(createCommand.input.CreateBucketConfiguration).toBeUndefined();
  });

  it('includes LocationConstraint for non us-east-1 regions', async () => {
    mockSend
      .mockRejectedValueOnce(new Error('NotFound'))
      .mockResolvedValueOnce({});
    const s3 = new S3Client({});
    await ensureBucket(s3, 'my-bucket', 'eu-west-1');
    const createCommand = mockSend.mock.calls[1][0];
    expect(createCommand.input.CreateBucketConfiguration).toEqual({ LocationConstraint: 'eu-west-1' });
  });

  it('omits LocationConstraint when region is undefined', async () => {
    mockSend
      .mockRejectedValueOnce(new Error('NotFound'))
      .mockResolvedValueOnce({});
    const s3 = new S3Client({});
    await ensureBucket(s3, 'my-bucket', undefined);
    const createCommand = mockSend.mock.calls[1][0];
    expect(createCommand.input.CreateBucketConfiguration).toBeUndefined();
  });
});
