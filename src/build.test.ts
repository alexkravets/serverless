'use strict';

import build from './build';
import { DEFAULT_ENV, DEFAULT_NODE_ENV, DEFAULT_TABLE } from './constants';

// Default service name derived from this package's own package.json:
// name: @kravc/serverless → kravc-serverless-v2
const PKG_SERVICE = 'kravc-serverless-v2';

beforeEach(() => {
  process.env.NODE_APP_INSTANCE = 'test';
  process.env.NODE_ENV          = 'serverless';
  delete process.env.GITHUB_ACTIONS;
  delete process.env.AWS_PROFILE;
});

describe('build()', () => {
  it.each([
    ['default service name', {}, `${PKG_SERVICE} (test)`],
    ['custom service name', { serverless: { service: 'my-api-v1' } }, 'my-api-v1 (test)'],
  ])('shows the correct template description for %s', (_label, config, expectedDescription) => {
    const result = build(config as never);
    expect(result.AWSTemplateFormatVersion).toBe('2010-09-09');
    expect(result.Description).toBe(expectedDescription);
  });

  describe('Lambda settings your API needs', () => {
    it('builds a Lambda name people can recognize', () => {
      const result = build({ serverless: { service: 'my-api-v1' } });
      const fn = getResources(result).ApiFunction.Properties;
      expect(fn.FunctionName).toBe('my-api-v1-test');
    });

    it('configures the Lambda so it can run', () => {
      const fn = getResources(build({})).ApiFunction.Properties;
      expect(fn.Handler).toBe('index.handler');
      expect(fn.Runtime).toBe('nodejs24.x');
      expect(fn.MemorySize).toBe(1024);
      expect(fn.Timeout).toBe(6);
    });

    it('uses your chosen timeout and memory size', () => {
      const fn = getResources(build({ serverless: { timeout: 30, memorySize: 512 } })).ApiFunction.Properties;
      expect(fn.Timeout).toBe(30);
      expect(fn.MemorySize).toBe(512);
    });

    it('adds the default environment variables', () => {
      const vars = getResources(build({})).ApiFunction.Properties.Environment.Variables;
      expect(vars.NODE_PATH).toBe('./');
      expect(vars.NODE_APP_INSTANCE).toBe('test');
      expect(vars.NODE_ENV).toBe('serverless');
    });

    it('keeps defaults while adding your custom environment variables', () => {
      const vars = getResources(build({ serverless: { environment: { MY_KEY: 'my-value' } } })).ApiFunction.Properties.Environment.Variables;
      expect(vars.MY_KEY).toBe('my-value');
      expect(vars.NODE_PATH).toBe('./');
    });

    it('wires the Lambda to the correct IAM role', () => {
      const fn = getResources(build({})).ApiFunction.Properties;
      expect(fn.Role).toEqual({ 'Fn::GetAtt': ['LambdaRole', 'Arn'] });
    });
  });

  describe('Logging your function writes', () => {
    it('creates the expected CloudWatch log group name', () => {
      const lg = getResources(build({ serverless: { service: 'my-api-v1' } })).ApiLogGroup.Properties;
      expect(lg.LogGroupName).toBe('/aws/lambda/my-api-v1-test');
    });
  });

  describe('API Gateway setup', () => {
    it('creates a REST API using EDGE connectivity', () => {
      const api = getResources(build({ serverless: { service: 'my-api-v1' } })).RestApi.Properties;
      expect(api.Name).toBe('my-api-v1-test');
      expect(api.EndpointConfiguration).toEqual({ Types: ['EDGE'] });
    });

    it('creates an endpoint that captures operationId in the URL', () => {
      const res = getResources(build({})).OperationResource.Properties;
      expect(res.PathPart).toBe('{operationId}');
    });

    it('handles the root GET request', () => {
      const method = getResources(build({})).RootGetMethod;
      expect(method.Type).toBe('AWS::ApiGateway::Method');
      expect(method.Properties.HttpMethod).toBe('GET');
      expect(method.Properties.Integration.Type).toBe('AWS_PROXY');
    });

    it.each(['Get', 'Post', 'Patch', 'Delete', 'Options'])('exposes the %s endpoint under /{operationId}', (suffix) => {
      const resources = getResources(build({}));
      const method    = resources[`Operation${suffix}Method`];
      expect(method?.Type).toBe('AWS::ApiGateway::Method');
      expect(method?.Properties.RequestParameters).toEqual({ 'method.request.path.operationId': true });
    });

    it('enables request validation for your API', () => {
      const v = getResources(build({})).ApiGatewayRequestValidator.Properties;
      expect(v.ValidateRequestBody).toBe(true);
      expect(v.ValidateRequestParameters).toBe(true);
    });

    it('creates the deployment and stage for the current environment', () => {
      const resources = getResources(build({}));
      expect(resources.ApiDeployment.Type).toBe('AWS::ApiGateway::Deployment');
      expect(resources.ApiStage.Properties.StageName).toBe('test');
    });
  });

  describe('Permissions your deployment needs', () => {
    it('lets the Lambda write CloudWatch logs', () => {
      const stmt = getIamStatements(build({ serverless: { service: 'my-api-v1' } }));
      const logs = stmt.find((s: { Action: string[] }) => s.Action.includes('logs:PutLogEvents'));
      expect(logs).toBeDefined();
      expect(logs.Resource).toContain('arn:aws:logs:*:*:log-group:/aws/lambda/my-api-v1-test');
    });

    it('allows API Gateway to invoke the Lambda', () => {
      const stmt   = getIamStatements(build({}));
      const invoke = stmt.find((s: { Action: string[] }) => s.Action.includes('lambda:InvokeFunction'));
      expect(invoke).toBeDefined();
      expect(invoke.Resource).toBe('*');
    });

    it('grants DynamoDB access when you configure a table', () => {
      const stmt   = getIamStatements(build({ aws: { region: 'us-east-1' }, dynamodb: { name: 'my-table' } }));
      const dynamo = stmt.find((s: { Action: string[] }) => s.Action.includes('dynamodb:Query'));
      expect(dynamo).toBeDefined();
      expect(dynamo.Resource[0]).toContain('my-table-test');
    });

    it('adds the environment suffix to the DynamoDB table name', () => {
      const stmt   = getIamStatements(build({ aws: { region: 'us-east-1' }, dynamodb: { name: 'users' } }));
      const dynamo = stmt.find((s: { Action: string[] }) => s.Action.includes('dynamodb:Query'));
      expect(dynamo.Resource[0]).toContain('users-test');
    });

    it('uses only the DynamoDB actions you specify', () => {
      const stmt   = getIamStatements(build({ dynamodb: { name: 'tbl', actions: ['dynamodb:GetItem'] } }));
      const dynamo  = stmt.find((s: { Action: string[] }) => Array.isArray(s.Action) && s.Action.includes('dynamodb:GetItem'));
      expect(dynamo.Action).toEqual(['dynamodb:GetItem']);
    });

    it('includes extra IAM permissions you provide', () => {
      const custom = { Effect: 'Allow', Action: ['s3:GetObject'], Resource: 'arn:aws:s3:::my-bucket/*' };
      const stmt   = getIamStatements(build({ serverless: { iamRoleStatements: [custom] } }));
      expect(stmt).toContainEqual(custom);
    });
  });

  describe('Post-deploy outputs', () => {
    it('provides the outputs you need after deployment', () => {
      const outputs = (build({}) as { Outputs: Record<string, unknown> }).Outputs;
      expect(outputs.ApiEndpoint).toBeDefined();
      expect(outputs.FunctionName).toBeDefined();
      expect(outputs.FunctionArn).toBeDefined();
    });

    it('returns the Lambda name in the expected format', () => {
      const outputs = (build({ serverless: { service: 'my-api-v1' } }) as { Outputs: Record<string, { Value: string }> }).Outputs;
      expect(outputs.FunctionName.Value).toBe('my-api-v1-test');
    });
  });

  it('copies your serverless.custom settings into the template', () => {
    const custom = { featureFlag: true, nested: { a: 1 } };
    const result = build({ serverless: { custom } });
    expect(result.custom).toBe(custom);
  });

  it('uses the default environment name when NODE_APP_INSTANCE is missing', () => {
    delete process.env.NODE_APP_INSTANCE;

    const result = build({});
    expect(result.Description).toBe(`${PKG_SERVICE} (${DEFAULT_ENV})`);
  });

  it('uses the default runtime mode when NODE_ENV is missing', () => {
    delete process.env.NODE_ENV;

    const vars = getResources(build({})).ApiFunction.Properties.Environment.Variables;
    expect(vars.NODE_ENV).toBe(DEFAULT_NODE_ENV);
  });

  it('uses the default table name when no DynamoDB name is given', () => {
    const stmt = getIamStatements(build({ aws: { region: 'us-east-1' }, dynamodb: {} }));
    const dynamo = stmt.find((s: { Action: string[] }) => s.Action.includes('dynamodb:Query'));
    expect(dynamo).toBeDefined();
    expect(dynamo!.Resource[0]).toContain(`${DEFAULT_TABLE}-test`);
  });
});

// Helpers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getResources = (template: Record<string, any>) => template.Resources;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getIamStatements = (template: Record<string, any>): any[] =>
  template.Resources.LambdaRole.Properties.Policies[0].PolicyDocument.Statement;
