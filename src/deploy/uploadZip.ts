'use strict';

import * as fs from 'fs';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const uploadZip = async (
  s3: S3Client,
  Bucket: string,
  zipPath: string
): Promise<string> => {
  const Key = `${Date.now()}.zip`;
  const Body = fs.createReadStream(zipPath);
  const ContentType = 'application/zip';

  const command = new PutObjectCommand({
    Key,
    Body,
    Bucket,
    ContentType,
  });

  console.log(`Uploading to s3://${Bucket}/${Key}...`);
  await s3.send(command);

  fs.unlinkSync(zipPath);

  return Key;
};

export default uploadZip;
