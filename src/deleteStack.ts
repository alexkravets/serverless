'use strict';

import {
  CloudFormationClient,
  DeleteStackCommand,
  waitUntilStackDeleteComplete,
} from '@aws-sdk/client-cloudformation';
import {
  S3Client,
  ListObjectVersionsCommand,
  DeleteObjectsCommand,
  DeleteBucketCommand,
} from '@aws-sdk/client-s3';
import getDeploymentMeta from './getDeploymentMeta';
import getConfig, { type Env } from './getConfig';

const deleteBucket = async (s3: S3Client, bucket: string) => {
  console.log(`Emptying deployment bucket ${bucket}...`);

  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;

  while (true) {
    const result = await s3.send(new ListObjectVersionsCommand({
      Bucket: bucket,
      KeyMarker: keyMarker,
      VersionIdMarker: versionIdMarker,
    }));

    const objects = [
      ...(result.Versions ?? []),
      ...(result.DeleteMarkers ?? []),
    ].map(({ Key, VersionId }) => ({ Key: Key!, VersionId }));

    if (objects.length > 0) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objects },
      }));
    }

    if (!result.IsTruncated) break;

    keyMarker = result.NextKeyMarker;
    versionIdMarker = result.NextVersionIdMarker;
  }

  await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
  console.log(`Deployment bucket ${bucket} deleted.`);
};

const deleteStack = async (env?: Env) => {
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

  try {
    await deleteBucket(s3, bucket);
  } catch (err) {
    if ((err as { name?: string }).name !== 'NoSuchBucket') throw err;
  }

  console.log(`Deleting stack ${stackName}...`);

  await cfn.send(new DeleteStackCommand({ StackName: stackName }));
  await waitUntilStackDeleteComplete({ client: cfn, maxWaitTime: 600 }, { StackName: stackName });

  console.log(`Stack ${stackName} deleted.`);
};

export default deleteStack;
