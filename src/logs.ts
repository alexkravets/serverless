'use strict';

import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import getDeploymentMeta from './getDeploymentMeta';
import getConfig, { type Env } from './getConfig';

const POLL_INTERVAL_MS = 2000;

const _getLogs = async (logs: CloudWatchLogsClient, command: FilterLogEventsCommand, logGroupName: string) => {
  let result;

  try {
    result = await logs.send(command);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    const isResourceNotFoundException = message.includes('ResourceNotFoundException');

    if (isResourceNotFoundException) {
      console.error(`Log group ${logGroupName} not found. Has the function been deployed?`);
      process.exit(1);
    }

    throw err;
  }

  return result;
};

const logs = async (env?: Env) => {
  const config = getConfig(env);

  const {
    region,
    profile,
    stackName,
  } = getDeploymentMeta(config);

  if (profile) {
    process.env.AWS_PROFILE = profile;
  }

  const logs = new CloudWatchLogsClient({ region });

  const logGroupName = `/aws/lambda/${stackName}`;
  console.log(`Tailing logs for ${logGroupName}...\n`);

  let nextToken: string | undefined;

  // NOTE: start from last 1 minute:
  let startTime = Date.now() - 60_000;

  while (true) {
    const command = new FilterLogEventsCommand({
      interleaved: true,
      startTime,
      nextToken,
      logGroupName,
    });

    const result = await _getLogs(logs, command, logGroupName);
    const events = result.events ?? [];

    for (const event of events) {
      const ts = new Date(event.timestamp ?? 0).toISOString();
      const msg = (event.message ?? '').trimEnd();

      console.log(`${ts}  ${msg}`);
    }

    if (result.nextToken) {
      nextToken = result.nextToken;

    } else {
      nextToken = undefined;
      startTime = Date.now() - 1000;

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
};

export default logs;
