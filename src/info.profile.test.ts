'use strict';

import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import info from './info';
import getConfig from './getConfig';
import getDeploymentMeta from './getDeploymentMeta';
import type { Config } from './getConfig';
import type { DeploymentMeta } from './getDeploymentMeta';

jest.mock('@aws-sdk/client-cloudformation');
jest.mock('./getConfig');
jest.mock('./getDeploymentMeta');

let mockSend: jest.Mock;

beforeEach(() => {
  delete process.env.GITHUB_ACTIONS;
  delete process.env.AWS_PROFILE;

  mockSend = jest.fn();
  jest.mocked(CloudFormationClient).mockImplementation(() => ({ send: mockSend }) as unknown as CloudFormationClient);

  jest.mocked(getConfig).mockReturnValue({} as unknown as Config);

  jest.mocked(getDeploymentMeta).mockReturnValue({
    region: 'us-east-1',
    profile: 'profile-123',
    stackName: 'my-stack',
  } as DeploymentMeta);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('info() - profile branch', () => {
  it('sets AWS_PROFILE when profile is present', async () => {
    mockSend.mockResolvedValue({
      Stacks: [{
        StackName: 'my-stack',
        StackStatus: 'CREATE_COMPLETE',
        Outputs: [],
      }],
    });

    jest.spyOn(console, 'log').mockImplementation();
    await info('dev');

    expect(process.env.AWS_PROFILE).toBe('profile-123');
  });

  it('does not set AWS_PROFILE when profile is undefined', async () => {
    jest.mocked(getDeploymentMeta).mockReturnValueOnce({
      region: 'us-east-1',
      profile: undefined,
      stackName: 'my-stack',
    } as DeploymentMeta);

    mockSend.mockResolvedValue({
      Stacks: [{
        StackName: 'my-stack',
        StackStatus: 'CREATE_COMPLETE',
        Outputs: [],
      }],
    });

    jest.spyOn(console, 'log').mockImplementation();
    await info('dev');

    expect(process.env.AWS_PROFILE).toBeUndefined();
  });
});

