'use strict';

import { CloudFormationClient, waitUntilStackDeleteComplete } from '@aws-sdk/client-cloudformation';
import { S3Client } from '@aws-sdk/client-s3';
import deleteStack from './deleteStack';
import getConfig from './getConfig';
import getDeploymentMeta from './getDeploymentMeta';
import type { Config } from './getConfig';
import type { DeploymentMeta } from './getDeploymentMeta';

jest.mock('@aws-sdk/client-cloudformation');
jest.mock('@aws-sdk/client-s3');
jest.mock('./getConfig');
jest.mock('./getDeploymentMeta');

const mockWaitUntilStackDeleteComplete = waitUntilStackDeleteComplete as jest.MockedFunction<typeof waitUntilStackDeleteComplete>;

let mockS3Send: jest.Mock;
let mockCfnSend: jest.Mock;

beforeEach(() => {
  delete process.env.AWS_PROFILE;

  mockS3Send  = jest.fn();
  mockCfnSend = jest.fn();

  jest.mocked(S3Client).mockImplementation(() => ({ send: mockS3Send }) as unknown as S3Client);
  jest.mocked(CloudFormationClient).mockImplementation(() => ({ send: mockCfnSend }) as unknown as CloudFormationClient);

  jest.mocked(getConfig).mockReturnValue({} as unknown as Config);

  jest.mocked(getDeploymentMeta).mockReturnValue({
    region: 'us-east-1',
    profile: undefined,
    stackName: 'my-stack',
  } as DeploymentMeta);

  mockWaitUntilStackDeleteComplete.mockResolvedValue({ state: 'SUCCESS' } as Awaited<ReturnType<typeof waitUntilStackDeleteComplete>>);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('deleteStack()', () => {
  it('empties bucket, deletes bucket, then deletes stack', async () => {
    mockS3Send
      .mockResolvedValueOnce({ Versions: [{ Key: 'a', VersionId: 'v1' }], DeleteMarkers: [], IsTruncated: false })
      .mockResolvedValueOnce({}) // DeleteObjectsCommand
      .mockResolvedValueOnce({}); // DeleteBucketCommand
    mockCfnSend.mockResolvedValueOnce({});

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await deleteStack('dev');

    expect(mockS3Send).toHaveBeenCalledTimes(3);
    expect(mockCfnSend).toHaveBeenCalledTimes(1);
    expect(mockWaitUntilStackDeleteComplete).toHaveBeenCalledTimes(1);

    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('my-stack-deployments');
    expect(output).toContain('my-stack');
    consoleSpy.mockRestore();
  });

  it('paginates bucket versions across multiple pages', async () => {
    mockS3Send
      .mockResolvedValueOnce({
        Versions: [{ Key: 'a', VersionId: 'v1' }],
        DeleteMarkers: [],
        IsTruncated: true,
        NextKeyMarker: 'a',
        NextVersionIdMarker: 'v1',
      })
      .mockResolvedValueOnce({}) // DeleteObjectsCommand (page 1)
      .mockResolvedValueOnce({
        Versions: [{ Key: 'b', VersionId: 'v2' }],
        DeleteMarkers: [],
        IsTruncated: false,
      })
      .mockResolvedValueOnce({}) // DeleteObjectsCommand (page 2)
      .mockResolvedValueOnce({}); // DeleteBucketCommand
    mockCfnSend.mockResolvedValueOnce({});

    jest.spyOn(console, 'log').mockImplementation();
    await deleteStack('dev');

    // 2x List + 2x DeleteObjects + 1x DeleteBucket = 5
    expect(mockS3Send).toHaveBeenCalledTimes(5);
  });

  it('skips DeleteObjects when page has no versions or delete markers', async () => {
    mockS3Send
      .mockResolvedValueOnce({ Versions: [], DeleteMarkers: [], IsTruncated: false })
      .mockResolvedValueOnce({}); // DeleteBucketCommand only
    mockCfnSend.mockResolvedValueOnce({});

    jest.spyOn(console, 'log').mockImplementation();
    await deleteStack('dev');

    // 1x List + 1x DeleteBucket = 2 (no DeleteObjects)
    expect(mockS3Send).toHaveBeenCalledTimes(2);
  });

  it('treats missing Versions and DeleteMarkers fields as empty arrays', async () => {
    mockS3Send
      .mockResolvedValueOnce({ IsTruncated: false }) // neither field present
      .mockResolvedValueOnce({}); // DeleteBucketCommand only
    mockCfnSend.mockResolvedValueOnce({});

    jest.spyOn(console, 'log').mockImplementation();
    await deleteStack('dev');

    expect(mockS3Send).toHaveBeenCalledTimes(2);
  });

  it('skips bucket deletion when bucket does not exist', async () => {
    const err = Object.assign(new Error('NoSuchBucket'), { name: 'NoSuchBucket' });
    mockS3Send.mockRejectedValueOnce(err);
    mockCfnSend.mockResolvedValueOnce({});

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await deleteStack('dev');

    expect(mockCfnSend).toHaveBeenCalledTimes(1);
    expect(mockWaitUntilStackDeleteComplete).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it('re-throws S3 errors other than NoSuchBucket', async () => {
    mockS3Send.mockRejectedValueOnce(Object.assign(new Error('AccessDenied'), { name: 'AccessDenied' }));

    jest.spyOn(console, 'log').mockImplementation();
    await expect(deleteStack('dev')).rejects.toThrow('AccessDenied');
  });

  it('sets AWS_PROFILE when profile is present', async () => {
    jest.mocked(getDeploymentMeta).mockReturnValueOnce({
      region: 'us-east-1',
      profile: 'profile-123',
      stackName: 'my-stack',
    } as DeploymentMeta);

    mockS3Send
      .mockResolvedValueOnce({ Versions: [], DeleteMarkers: [], IsTruncated: false })
      .mockResolvedValueOnce({});
    mockCfnSend.mockResolvedValueOnce({});

    jest.spyOn(console, 'log').mockImplementation();
    await deleteStack('dev');

    expect(process.env.AWS_PROFILE).toBe('profile-123');
  });

  it('does not set AWS_PROFILE when profile is undefined', async () => {
    mockS3Send
      .mockResolvedValueOnce({ Versions: [], DeleteMarkers: [], IsTruncated: false })
      .mockResolvedValueOnce({});
    mockCfnSend.mockResolvedValueOnce({});

    jest.spyOn(console, 'log').mockImplementation();
    await deleteStack('dev');

    expect(process.env.AWS_PROFILE).toBeUndefined();
  });
});
