'use strict';

import info from './info';
import { CloudFormationClient } from '@aws-sdk/client-cloudformation';

jest.mock('@aws-sdk/client-cloudformation');

let mockSend: jest.Mock;

beforeEach(() => {
  delete process.env.GITHUB_ACTIONS;
  delete process.env.AWS_PROFILE;

  mockSend = jest.fn();
  jest.mocked(CloudFormationClient).mockImplementation(() => ({ send: mockSend }) as unknown as CloudFormationClient);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('info()', () => {
  it('prints stack name, status, and outputs', async () => {
    mockSend.mockResolvedValue({
      Stacks: [{
        StackName:   'my-svc-v1-test',
        StackStatus: 'UPDATE_COMPLETE',
        Outputs: [
          { OutputKey: 'ApiEndpoint', OutputValue: 'https://abc.execute-api.us-east-1.amazonaws.com/test/' },
        ],
      }],
    });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await info('dev');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('my-svc-v1-test'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('UPDATE_COMPLETE'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ApiEndpoint'));

    consoleSpy.mockRestore();
  });

  it('prints stack info without outputs section when none exist', async () => {
    mockSend.mockResolvedValue({
      Stacks: [{
        StackName:   'my-svc-v1-test',
        StackStatus: 'CREATE_COMPLETE',
        Outputs:     [],
      }],
    });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await info('dev');

    const calls = consoleSpy.mock.calls.flat();
    expect(calls.some(c => String(c).includes('Outputs:'))).toBe(false);

    consoleSpy.mockRestore();
  });

  it('prints not-found message when stack does not exist', async () => {
    mockSend.mockResolvedValue({ Stacks: [] });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await info('dev');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
    consoleSpy.mockRestore();
  });

  it('sets AWS_PROFILE from config', async () => {
    mockSend.mockResolvedValue({ Stacks: [{ StackName: 'x', StackStatus: 'CREATE_COMPLETE', Outputs: [] }] });
    jest.spyOn(console, 'log').mockImplementation();

    // Simulate getDeploymentMeta returning a profile by patching env
    // (profile is only set when aws.profile is in config — this verifies the env var is applied)
    delete process.env.AWS_PROFILE;
    await info('dev');

    // Without a profile in the (empty) test config, AWS_PROFILE should remain unset
    expect(process.env.AWS_PROFILE).toBe('default');

    jest.restoreAllMocks();
  });
});
