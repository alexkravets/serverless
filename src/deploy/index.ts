'use strict';

import { S3Client } from '@aws-sdk/client-s3';
import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import createZip from './createZip';
import uploadZip from './uploadZip';
import deployStack from './deployStack';
import ensureBucket from './ensureBucket';
import createTemplate from './createTemplate';
import getDeploymentMeta from '../getDeploymentMeta';
import getConfig, { type Env } from '../getConfig';

const deploy = async (env?: Env) => {
  const config = getConfig(env);

  const {
    region,
    profile,
    stackName,
  } = getDeploymentMeta(config);

  if (profile) {
    process.env.AWS_PROFILE = profile;
  }

  const clientConfig = { region };
  const s3 = new S3Client(clientConfig);
  const cfn = new CloudFormationClient(clientConfig);
  const bucket = `${stackName}-deployments`;

  await ensureBucket(s3, bucket, region);

  const zipPath = await createZip(stackName);

  const s3Key = await uploadZip(s3, bucket, zipPath);

  const template = createTemplate(config, bucket, s3Key);

  await deployStack(cfn, stackName, template);
};

export default deploy;
