'use strict';

import {
  CloudFormationClient,
  DescribeStacksCommand
} from '@aws-sdk/client-cloudformation';

const shouldCreateStack = async (
  cfn: CloudFormationClient,
  stackName: string
): Promise<boolean> => {
  let result;

  try {
    result = await cfn.send(new DescribeStacksCommand({ StackName: stackName }));

  } catch {
    return true;

  }

  const stack = result.Stacks?.[0];
  const shouldCreate = !stack || stack.StackStatus === 'REVIEW_IN_PROGRESS';

  return shouldCreate;
};

export default shouldCreateStack;
