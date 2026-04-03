#!/usr/bin/env node

'use strict';

const [command, env = 'dev'] = process.argv.slice(2);

if (!command) {
  console.error('Usage: sls <command> [env]');
  console.error('Commands: build, deploy, delete, info, logs');
  process.exit(1);
}

process.env.NODE_ENV = 'serverless';
process.env.NODE_APP_INSTANCE = env;

switch (command) {
  case 'build': {
    const fs = require('fs');
    const config = require('config');
    const { dump } = require('js-yaml');
    const { build, getDeploymentMeta } = require('../dist');

    const input = JSON.parse(JSON.stringify(config));
    const template = build(input);
    const { stackName, region, profile } = getDeploymentMeta(input);

    fs.mkdirSync('.serverless', { recursive: true });
    fs.writeFileSync('.serverless/template.yaml', dump(template));
    fs.writeFileSync('.serverless/.deployment', [
      `STACK_NAME=${stackName}`,
      `REGION=${region || ''}`,
      `PROFILE=${profile || ''}`,
    ].join('\n') + '\n');
    break;
  }

  case 'deploy':
    require('../dist/deploy').default(env).catch(err => {
      console.error(err.message || err);
      process.exit(1);
    });
    break;

  case 'delete':
    require('../dist/delete').default(env).catch(err => {
      console.error(err.message || err);
      process.exit(1);
    });
    break;

  case 'info':
    require('../dist/info').default(env).catch(err => {
      console.error(err.message || err);
      process.exit(1);
    });
    break;

  case 'logs':
    require('../dist/logs').default(env).catch(err => {
      console.error(err.message || err);
      process.exit(1);
    });
    break;

  default:
    console.error(`Unknown command: ${command}`);
    console.error('Commands: build, deploy, delete, info, logs');
    process.exit(1);
}
