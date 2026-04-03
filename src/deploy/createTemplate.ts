'use strict';

import * as fs from 'fs';
import { dump } from 'js-yaml';
import build from '../build';
import { type Config } from '../getConfig';

const createTemplate = (config: Config, S3Bucket: string, S3Key: string) => {
  const template = build(config);

  const resources = template.Resources as Record<string, Record<string, unknown>>;

  const apiFunctionProps = resources.ApiFunction.Properties as Record<string, unknown>;

  apiFunctionProps.Code = {
    S3Bucket,
    S3Key
  };

  fs.mkdirSync('.serverless', { recursive: true });
  fs.writeFileSync('.serverless/template.yaml', dump(template));

  return template;
};

export default createTemplate;
