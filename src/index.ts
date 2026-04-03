'use strict';

export { default as build } from './build';
export { default as deploy } from './deploy';
export { default as getDeploymentMeta } from './getDeploymentMeta';

export type { DeploymentMeta } from './getDeploymentMeta';
export type { Config, DynamoTableConfig } from './getConfig';
