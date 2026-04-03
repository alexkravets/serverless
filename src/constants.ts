'use strict';

const ROOT_PATH = process.cwd();

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require(`${ROOT_PATH}/package.json`) as { name: string; version: string };

const [MAJOR_VERSION] = pkg.version.split('.');
const DEFAULT_SERVICE = pkg.name.replace('@', '').replace('/', '-') + `-v${MAJOR_VERSION}`;
const DEFAULT_TABLE = pkg.name.replace('@', '').replace('/', '-');

const DEFAULT_ENV = 'dev';
const DEFAULT_NODE_ENV = 'serverless';

const DEFAULT_MEMORY = 1024;
const DEFAULT_RUNTIME = 'nodejs24.x';
const DEFAULT_TIMEOUT = 6;

export {
  DEFAULT_ENV,
  DEFAULT_TABLE,
  DEFAULT_NODE_ENV,
  DEFAULT_SERVICE,
  DEFAULT_MEMORY,
  DEFAULT_RUNTIME,
  DEFAULT_TIMEOUT,
};
