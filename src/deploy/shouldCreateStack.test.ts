'use strict';

import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import shouldCreateStack from './shouldCreateStack';

jest.mock('@aws-sdk/client-cloudformation');

let mockSend: jest.Mock;

beforeEach(() => {
  mockSend = jest.fn();
  jest.mocked(CloudFormationClient).mockImplementation(() => ({ send: mockSend }) as unknown as CloudFormationClient);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('shouldCreateStack()', () => {
  it.each([
    [
      'the stack does not exist yet',
      () => mockSend.mockRejectedValueOnce(new Error('Stack with id foo does not exist')),
      true,
    ],
    [
      'the stack already exists and is finished',
      () => mockSend.mockResolvedValueOnce({ Stacks: [{ StackStatus: 'UPDATE_COMPLETE' }] }),
      false,
    ],
    [
      'the stack exists but is still in review',
      () => mockSend.mockResolvedValueOnce({ Stacks: [{ StackStatus: 'REVIEW_IN_PROGRESS' }] }),
      true,
    ],
    [
      'DescribeStacks returns no stacks',
      () => mockSend.mockResolvedValueOnce({ Stacks: [] }),
      true,
    ],
  ])('decides whether to create the stack when %s', async (_label, setup, expected) => {
    setup();
    const cfn = new CloudFormationClient({});
    expect(await shouldCreateStack(cfn, 'foo')).toBe(expected);
  });
});
