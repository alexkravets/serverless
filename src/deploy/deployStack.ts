'use strict';

import {
  CloudFormationClient,
  CreateChangeSetCommand,
  DeleteChangeSetCommand,
  DescribeChangeSetCommand,
  DescribeStacksCommand,
  ExecuteChangeSetCommand,
  waitUntilChangeSetCreateComplete,
  waitUntilStackCreateComplete,
  waitUntilStackUpdateComplete,
} from '@aws-sdk/client-cloudformation';
import shouldCreateStack from './shouldCreateStack';

const _waitForChangeSet = async (
  cfn: CloudFormationClient,
  StackName: string,
  ChangeSetName: string
) => {
  const waiter = waitUntilChangeSetCreateComplete;

  try {
    await waiter(
      { client: cfn, maxWaitTime: 300 },
      { StackName, ChangeSetName },
    );

  } catch {
    const desc = await cfn.send(new DescribeChangeSetCommand({ StackName, ChangeSetName }));

    const reason = desc.StatusReason ?? '';

    const hasNoChanges =
      reason.includes('didn\'t contain changes') ||
      reason.includes('No updates are to be performed');

    if (hasNoChanges) {
      console.log('No changes to deploy.');

      const command = new DeleteChangeSetCommand({ StackName, ChangeSetName });
      await cfn.send(command);

      return;
    }

    throw new Error(`Change set failed: ${reason}`);
  }
};

const deployStack = async (
  cfn: CloudFormationClient,
  StackName: string,
  template: Record<string, unknown>
) => {
  const TemplateBody = JSON.stringify(template);
  const ChangeSetName = `deploy-${Date.now()}`;

  const ChangeSetType = (await shouldCreateStack(cfn, StackName))
    ? 'CREATE'
    : 'UPDATE';

  const command1 = new CreateChangeSetCommand({
    Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
    StackName,
    TemplateBody,
    ChangeSetName,
    ChangeSetType,
  });

  console.log(`Deploying stack ${StackName}...`);

  await cfn.send(command1);

  await _waitForChangeSet(cfn, StackName, ChangeSetName);

  const command2 = new ExecuteChangeSetCommand({ StackName, ChangeSetName });

  await cfn.send(command2);

  const waiter = ChangeSetType === 'CREATE'
    ? waitUntilStackCreateComplete
    : waitUntilStackUpdateComplete;

  await waiter({ client: cfn, maxWaitTime: 600 }, { StackName });

  const command3 = new DescribeStacksCommand({ StackName });

  const result = await cfn.send(command3);
  const outputs = result.Stacks?.[0]?.Outputs ?? [];

  console.log('\nDeployment complete:');

  for (const output of outputs) {
    console.log(`  ${output.OutputKey}: ${output.OutputValue}`);
  }
};

export default deployStack;
