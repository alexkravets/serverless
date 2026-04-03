'use strict';

import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import getDeploymentMeta from './getDeploymentMeta';
import getConfig, { type Env } from './getConfig';

const info = async (env?: Env) => {
  const config = getConfig(env);

  const {
    region,
    profile,
    stackName,
  } = getDeploymentMeta(config);

  if (profile) {
    process.env.AWS_PROFILE = profile;
  }

  const cfn = new CloudFormationClient({ region });

  const result = await cfn.send(new DescribeStacksCommand({ StackName: stackName }));
  const stack = result.Stacks?.[0];

  if (!stack) {
    console.log(`Stack ${stackName} not found.`);
    return;
  }

  console.log(`\nStack: ${stack.StackName}`);
  console.log(`Status: ${stack.StackStatus}`);

  const hasOutputs = stack.Outputs?.length;

  if (hasOutputs) {
    console.log('\nOutputs:');

    for (const output of stack.Outputs!) {
      console.log(`  ${output.OutputKey}: ${output.OutputValue}`);
    }
  }
};

export default info;
