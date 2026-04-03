'use strict';

import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
  type BucketLocationConstraint,
} from '@aws-sdk/client-s3';

const ensureBucket = async (s3: S3Client, bucket: string, region: string | undefined) => {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return;

  } catch {
    console.log(`Creating deployment bucket: ${bucket}...`);

  }

  const params: ConstructorParameters<typeof CreateBucketCommand>[0] = { Bucket: bucket };

  const isCustomRegion = region && region !== 'us-east-1';

  if (isCustomRegion) {
    params.CreateBucketConfiguration = {
      LocationConstraint: region as BucketLocationConstraint
    };
  }

  const command = new CreateBucketCommand(params);

  await s3.send(command);
};

export default ensureBucket;
