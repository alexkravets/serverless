'use strict';

import {
  CloudFormationClient,
  waitUntilChangeSetCreateComplete,
  waitUntilStackCreateComplete,
  waitUntilStackUpdateComplete,
} from '@aws-sdk/client-cloudformation';
import deployStack from './deployStack';
import shouldCreateStack from './shouldCreateStack';

jest.mock('@aws-sdk/client-cloudformation', () => {
  const actual = jest.requireActual('@aws-sdk/client-cloudformation');
  return {
    ...actual,
    CloudFormationClient: jest.fn(),
    waitUntilChangeSetCreateComplete: jest.fn(),
    waitUntilStackCreateComplete: jest.fn(),
    waitUntilStackUpdateComplete: jest.fn(),
  };
});
jest.mock('./shouldCreateStack');

let mockSend: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSend = jest.fn();
  jest.mocked(CloudFormationClient).mockImplementation(() => ({ send: mockSend }) as unknown as CloudFormationClient);
  jest.mocked(waitUntilChangeSetCreateComplete).mockResolvedValue({ state: 'SUCCESS', reason: '' } as never);
  jest.mocked(waitUntilStackCreateComplete).mockResolvedValue({ state: 'SUCCESS', reason: '' } as never);
  jest.mocked(waitUntilStackUpdateComplete).mockResolvedValue({ state: 'SUCCESS', reason: '' } as never);
  jest.spyOn(console, 'log').mockImplementation();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('deployStack()', () => {
  it('uses CREATE change set type on first deploy', async () => {
    jest.mocked(shouldCreateStack).mockResolvedValueOnce(true);
    mockSend
      .mockResolvedValueOnce({}) // CreateChangeSet
      .mockResolvedValueOnce({}) // ExecuteChangeSet
      .mockResolvedValueOnce({ Stacks: [{ Outputs: [] }] }); // DescribeStacks

    const cfn = new CloudFormationClient({});
    await deployStack(cfn, 'my-stack', {});

    const createCommand = mockSend.mock.calls[0][0];
    expect(createCommand.input.ChangeSetType).toBe('CREATE');
    expect(waitUntilStackCreateComplete).toHaveBeenCalled();
    expect(waitUntilStackUpdateComplete).not.toHaveBeenCalled();
  });

  it('uses UPDATE change set type when stack already exists', async () => {
    jest.mocked(shouldCreateStack).mockResolvedValueOnce(false);
    mockSend
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Stacks: [{ Outputs: [] }] });

    const cfn = new CloudFormationClient({});
    await deployStack(cfn, 'my-stack', {});

    const createCommand = mockSend.mock.calls[0][0];
    expect(createCommand.input.ChangeSetType).toBe('UPDATE');
    expect(waitUntilStackUpdateComplete).toHaveBeenCalled();
    expect(waitUntilStackCreateComplete).not.toHaveBeenCalled();
  });

  it('prints stack outputs after successful deploy', async () => {
    jest.mocked(shouldCreateStack).mockResolvedValueOnce(false);
    mockSend
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        Stacks: [{
          Outputs: [
            { OutputKey: 'ApiEndpoint', OutputValue: 'https://abc.execute-api.us-east-1.amazonaws.com/dev/' },
          ],
        }],
      });

    const cfn = new CloudFormationClient({});
    await deployStack(cfn, 'my-stack', {});

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('ApiEndpoint'));
  });

  it('logs no-changes message and deletes change set when nothing changed', async () => {
    jest.mocked(shouldCreateStack).mockResolvedValueOnce(false);
    jest.mocked(waitUntilChangeSetCreateComplete).mockRejectedValueOnce(new Error('waiter failed'));

    mockSend
      .mockResolvedValueOnce({}) // CreateChangeSet
      .mockResolvedValueOnce({ StatusReason: 'The submitted information didn\'t contain changes.' }) // DescribeChangeSet
      .mockResolvedValueOnce({}) // DeleteChangeSet
      .mockResolvedValueOnce({}) // ExecuteChangeSet (called after _waitForChangeSet returns)
      .mockResolvedValueOnce({ Stacks: [{ Outputs: [] }] }); // DescribeStacks

    const cfn = new CloudFormationClient({});
    await deployStack(cfn, 'my-stack', {});

    expect(console.log).toHaveBeenCalledWith('No changes to deploy.');
  });

  it('throws when change set fails with a real error', async () => {
    jest.mocked(shouldCreateStack).mockResolvedValueOnce(false);
    jest.mocked(waitUntilChangeSetCreateComplete).mockRejectedValueOnce(new Error('waiter failed'));

    mockSend
      .mockResolvedValueOnce({}) // CreateChangeSet
      .mockResolvedValueOnce({ StatusReason: 'Template format error: unexpected property.' }); // DescribeChangeSet

    const cfn = new CloudFormationClient({});

    await expect(deployStack(cfn, 'my-stack', {}))
      .rejects.toThrow('Change set failed: Template format error: unexpected property.');
  });

  it('uses empty reason when DescribeChangeSet has no StatusReason', async () => {
    jest.mocked(shouldCreateStack).mockResolvedValueOnce(false);
    jest.mocked(waitUntilChangeSetCreateComplete).mockRejectedValueOnce(new Error('waiter failed'));

    mockSend
      .mockResolvedValueOnce({}) // CreateChangeSet
      .mockResolvedValueOnce({}); // DescribeChangeSet (no StatusReason)

    const cfn = new CloudFormationClient({});

    await expect(deployStack(cfn, 'my-stack', {}))
      .rejects.toThrow('Change set failed:');
  });

  it('defaults outputs to [] when DescribeStacks has Outputs = undefined', async () => {
    jest.mocked(shouldCreateStack).mockResolvedValueOnce(false);

    mockSend
      .mockResolvedValueOnce({}) // CreateChangeSet
      .mockResolvedValueOnce({}) // ExecuteChangeSet
      .mockResolvedValueOnce({ Stacks: [{ Outputs: undefined }] }); // DescribeStacks

    const cfn = new CloudFormationClient({});
    await deployStack(cfn, 'my-stack', {});

    expect(console.log).toHaveBeenCalledWith('\nDeployment complete:');
  });

  it('includes CAPABILITY_IAM and CAPABILITY_NAMED_IAM', async () => {
    jest.mocked(shouldCreateStack).mockResolvedValueOnce(true);
    mockSend
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Stacks: [{ Outputs: [] }] });

    const cfn = new CloudFormationClient({});
    await deployStack(cfn, 'my-stack', {});

    const createCommand = mockSend.mock.calls[0][0];
    expect(createCommand.input.Capabilities).toContain('CAPABILITY_IAM');
    expect(createCommand.input.Capabilities).toContain('CAPABILITY_NAMED_IAM');
  });
});
