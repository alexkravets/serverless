'use strict';

import { DEFAULT_ENV, DEFAULT_NODE_ENV } from './constants';

export interface DynamoTableConfig {
  name?: string;
  actions?: string[];
}

export interface Config {
  aws?: {
    region?: string;
    profile?: string;
  };
  serverless?: {
    service?: string;
    environment?: Record<string, string>;
    iamRoleStatements?: object[];
    timeout?: number;
    memorySize?: number;
    custom?: object;
  };
  dynamodb?: DynamoTableConfig;
}

export type Env = 'dev' | 'stg' | 'prd';

const getConfig = (env: Env = DEFAULT_ENV) => {
  process.env.NODE_ENV = DEFAULT_NODE_ENV;
  process.env.NODE_APP_INSTANCE = env;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const config: Config = JSON.parse(JSON.stringify(require('config')));

  return config;
};

export default getConfig;
