'use strict';

import { type Config } from './getConfig';
import {
  DEFAULT_ENV,
  DEFAULT_TABLE,
  DEFAULT_SERVICE,
  DEFAULT_NODE_ENV,
  DEFAULT_MEMORY,
  DEFAULT_RUNTIME,
  DEFAULT_TIMEOUT
} from './constants';

const DEFAULT_DYNAMO_ACTIONS = [
  'dynamodb:Query',
  'dynamodb:Scan',
  'dynamodb:GetItem',
  'dynamodb:PutItem',
  'dynamodb:UpdateItem',
  'dynamodb:DeleteItem',
];

const build = (config: Config) => {
  const env = process.env.NODE_APP_INSTANCE || DEFAULT_ENV;
  const nodeEnv = process.env.NODE_ENV || DEFAULT_NODE_ENV;

  const aws = config.aws ?? {};
  const serverless = config.serverless ?? {};

  const serviceName = serverless.service ?? DEFAULT_SERVICE;
  const functionName = `${serviceName}-${env}`;

  const region = aws.region;

  const timeout = serverless.timeout ?? DEFAULT_TIMEOUT;
  const memorySize = serverless.memorySize ?? DEFAULT_MEMORY;

  // NOTE: IAM statements
  const iamStatements: object[] = [
    {
      Effect: 'Allow',
      Action: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:TagResource',
        'logs:PutLogEvents'
      ],
      Resource: [
        `arn:aws:logs:*:*:log-group:/aws/lambda/${functionName}`,
        `arn:aws:logs:*:*:log-group:/aws/lambda/${functionName}:*`,
      ],
    },
    {
      Effect: 'Allow',
      Action: [
        'lambda:InvokeFunction',
        'lambda:InvokeAsync',
        'lambda:Invoke'
      ],
      Resource: '*',
    },
  ];

  // NOTE: DynamoDB table
  if (config.dynamodb) {
    const tableName = `${config.dynamodb.name ?? DEFAULT_TABLE}-${env}`;

    const actions = config.dynamodb.actions ?? DEFAULT_DYNAMO_ACTIONS;

    const tableArn = region
      ? `arn:aws:dynamodb:${region}:*:table/${tableName}`
      : { 'Fn::Sub': `arn:aws:dynamodb:\${AWS::Region}:*:table/${tableName}` };

    const tableIndexArn = region
      ? `arn:aws:dynamodb:${region}:*:table/${tableName}/*`
      : { 'Fn::Sub': `arn:aws:dynamodb:\${AWS::Region}:*:table/${tableName}/*` };

    iamStatements.push({
      Effect: 'Allow',
      Action: actions,
      Resource: [ tableArn, tableIndexArn ]
    });
  }

  if (serverless.iamRoleStatements) {
    iamStatements.push(...serverless.iamRoleStatements);
  }

  // NOTE: Lambda environment
  const environment: Record<string, string> = {
    NODE_ENV: nodeEnv,
    NODE_PATH: './',
    NODE_APP_INSTANCE: env,
    ...(serverless.environment ?? {}),
  };

  const GATEWAY_METHODS = [
    'GET',
    'POST',
    'PATCH',
    'DELETE',
    'OPTIONS'
  ];

  const integrationUri = { 'Fn::Sub': 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${ApiFunction.Arn}/invocations' };

  const operationMethods: Record<string, object> = {};

  for (const method of GATEWAY_METHODS) {
    const methodTitle = method[0] + method.slice(1).toLowerCase();
    const id = `Operation${methodTitle}Method`;

    operationMethods[id] = {
      Type: 'AWS::ApiGateway::Method',
      Properties: {
        RestApiId: { Ref: 'RestApi' },
        ResourceId: { Ref: 'OperationResource' },
        HttpMethod: method,
        AuthorizationType: 'NONE',
        RequestValidatorId: { Ref: 'ApiGatewayRequestValidator' },
        RequestParameters: { 'method.request.path.operationId': true },
        Integration: {
          Uri: integrationUri,
          Type: 'AWS_PROXY',
          IntegrationHttpMethod: 'POST',
        },
      },
    };
  }

  const deploymentDependsOn = [
    'RootGetMethod',
    ...Object.keys(operationMethods),
  ];

  const template: Record<string, unknown> = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: `${serviceName} (${env})`,

    Resources: {
      LambdaRole: {
        Type: 'AWS::IAM::Role',
        Properties: {
          RoleName: { 'Fn::Sub': `${serviceName}-${env}-\${AWS::Region}-lambdaRole` },
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Action: 'sts:AssumeRole',
              Principal: { Service: 'lambda.amazonaws.com' },
            }],
          },
          Policies: [{
            PolicyName: `${serviceName}-${env}-lambda`,
            PolicyDocument: { Version: '2012-10-17', Statement: iamStatements },
          }],
        },
      },

      ApiLogGroup: {
        Type: 'AWS::Logs::LogGroup',
        Properties: { LogGroupName: `/aws/lambda/${functionName}` },
      },

      ApiFunction: {
        Type: 'AWS::Lambda::Function',
        DependsOn: 'ApiLogGroup',
        Properties: {
          Handler: 'index.handler',
          Runtime: DEFAULT_RUNTIME,
          Timeout: timeout,
          MemorySize: memorySize,
          FunctionName: functionName,
          Code: {
            S3Key: 'function.zip',
            S3Bucket: 'DEPLOYMENT_BUCKET_PLACEHOLDER',
          },
          Environment: { Variables: environment },
          Role: { 'Fn::GetAtt': ['LambdaRole', 'Arn'] },
        },
      },

      RestApi: {
        Type: 'AWS::ApiGateway::RestApi',
        Properties: {
          Name: `${serviceName}-${env}`,
          EndpointConfiguration: { Types: ['EDGE'] },
        },
      },

      ApiGatewayRequestValidator: {
        Type: 'AWS::ApiGateway::RequestValidator',
        Properties: {
          Name: `${serviceName}-${env} | Validate request body and querystring parameters`,
          RestApiId: { Ref: 'RestApi' },
          ValidateRequestBody: true,
          ValidateRequestParameters: true,
        },
      },

      OperationResource: {
        Type: 'AWS::ApiGateway::Resource',
        Properties: {
          ParentId: { 'Fn::GetAtt': ['RestApi', 'RootResourceId'] },
          PathPart: '{operationId}',
          RestApiId: { Ref: 'RestApi' },
        },
      },

      RootGetMethod: {
        Type: 'AWS::ApiGateway::Method',
        Properties: {
          RestApiId: { Ref: 'RestApi' },
          ResourceId: { 'Fn::GetAtt': ['RestApi', 'RootResourceId'] },
          HttpMethod: 'GET',
          AuthorizationType: 'NONE',
          Integration: {
            Uri: integrationUri,
            Type: 'AWS_PROXY',
            IntegrationHttpMethod: 'POST',
          },
        },
      },

      ...operationMethods,

      ApiDeployment: {
        Type: 'AWS::ApiGateway::Deployment',
        DependsOn: deploymentDependsOn,
        Properties: { RestApiId: { Ref: 'RestApi' } },
      },

      ApiStage: {
        Type: 'AWS::ApiGateway::Stage',
        Properties: {
          RestApiId: { Ref: 'RestApi' },
          StageName: env,
          DeploymentId: { Ref: 'ApiDeployment' },
        },
      },

      ApiGatewayPermission: {
        Type: 'AWS::Lambda::Permission',
        Properties: {
          Action: 'lambda:InvokeFunction',
          Principal: 'apigateway.amazonaws.com',
          SourceArn: { 'Fn::Sub': 'arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${RestApi}/*/*' },
          FunctionName: { 'Fn::GetAtt': ['ApiFunction', 'Arn'] },
        },
      },
    },

    Outputs: {
      ApiEndpoint: {
        Description: 'API Gateway endpoint URL',
        Value: { 'Fn::Sub': `https://\${RestApi}.execute-api.\${AWS::Region}.amazonaws.com/${env}/` },
      },
      FunctionName: {
        Description: 'Lambda function name',
        Value: functionName,
      },
      FunctionArn: {
        Description: 'Lambda function ARN',
        Value: { 'Fn::GetAtt': ['ApiFunction', 'Arn'] },
      },
    },
  };

  if (serverless.custom) {
    template.custom = serverless.custom;
  }

  return template;
};

export default build;
