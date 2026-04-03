'use strict';

import { type Config } from './getConfig';
import { DEFAULT_SERVICE, DEFAULT_ENV } from './constants';

export interface DeploymentMeta {
  stackName: string;
  region: string | undefined;
  profile: string | undefined;
}

const getDeploymentMeta = (config: Config): DeploymentMeta => {
  const env = process.env.NODE_APP_INSTANCE || DEFAULT_ENV;

  const aws = config.aws ?? {};
  const serverless = config.serverless ?? {};

  const serviceName = serverless.service ?? DEFAULT_SERVICE;
  const stackName = `${serviceName}-${env}`;

  const isProfileRequired = aws.profile && !process.env.GITHUB_ACTIONS;

  const profile = isProfileRequired
    ? aws.profile
    : undefined;

  const region = aws.region;

  return {
    region,
    profile,
    stackName,
  };
};

export default getDeploymentMeta;
