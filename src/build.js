'use strict'

const get = require('lodash.get')

const NODE_ENV  = process.env.NODE_ENV || 'serverless'
const INSTANCE  = process.env.NODE_APP_INSTANCE || 'localhost'
const ROOT_PATH = process.cwd()

const { name, version } = require(`${ROOT_PATH}/package.json`)
const [ MAJOR_VERSION ] = version.split('.')
const DEFAULT_SERVICE   = name.replace('@', '').replace('/', '-') + `-v${MAJOR_VERSION}`

const build = config => {
  const AWS = get(config, 'aws', {})
  const SERVERLESS = get(config, 'serverless', {})

  const result = {
    service: SERVERLESS.service || DEFAULT_SERVICE,
    variablesResolutionMode: 20210326
  }

  result.provider = {
    name:    'aws',
    stage:   INSTANCE,
    runtime: 'nodejs12.x',
    environment: {
      NODE_PATH:         './',
      NODE_APP_INSTANCE: INSTANCE,
      NODE_ENV,
      ...(SERVERLESS.environment || {})
    },
    iamRoleStatements: [{
      Effect: 'Allow',
      Action: [
        'lambda:InvokeFunction',
        'lambda:InvokeAsync',
        'lambda:Invoke'
      ],
      Resource: '*'
    }],
    apiGateway: {
      shouldStartNameWithService: true
    },
    lambdaHashingVersion: '20201221'
  }

  if (AWS.region) {
    result.provider.region = AWS.region
  }

  if (AWS.profile) {
    result.provider.profile = AWS.profile
  }

  result.package = {
    patterns: [
      '!test/**',
      '!bin/**'
    ]
  }

  result.functions = {
    api: {
      handler: 'index.handler',
      events:  [
        {
          http: {
            method: 'get',
            path:   '/'
          }
        }
      ]
    }
  }

  const DEFAULT_HTTP_METHODS = [
    'get',
    'post',
    'patch',
    'delete',
    'options'
  ]

  for (const method of DEFAULT_HTTP_METHODS) {
    const path = '/{operationId}'
    const http = {
      path,
      method,
      request: {
        parameters: {
          paths: {
            operationId: true
          }
        }
      }
    }

    result.functions.api.events.push({ http })
  }

  if (SERVERLESS.iamRoleStatements) {
    result.provider.iamRoleStatements =
      result.provider.iamRoleStatements.concat(SERVERLESS.iamRoleStatements)
  }

  if (SERVERLESS.timeout) {
    result.provider.timeout = SERVERLESS.timeout
  }

  if (SERVERLESS.custom) {
    result.custom = SERVERLESS.custom
  }

  const TABLES = get(config, 'tables')

  if (TABLES) {
    const DEFAULT_TABLE_ACTIONS = [
      'dynamodb:Query',
      'dynamodb:Scan',
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem',
      'dynamodb:DeleteItem'
    ]

    for (const tableKey in TABLES) {
      const tableConfig = TABLES[tableKey]
      const { name = DEFAULT_SERVICE, actions = DEFAULT_TABLE_ACTIONS } = tableConfig

      const tableName = `${name}-${INSTANCE}`

      const statement = {
        Effect: 'Allow',
        Action: actions,
        Resource: [
          `arn:aws:dynamodb:\${opt:region, self:provider.region}:*:table/${tableName}`,
          `arn:aws:dynamodb:\${opt:region, self:provider.region}:*:table/${tableName}/*`
        ]
      }

      result.provider.iamRoleStatements.push(statement)
    }
  }

  if (result.provider.iamRoleStatements) {
    result.provider.iam = { role: { statements: result.provider.iamRoleStatements } }
    delete result.provider.iamRoleStatements
  }

  return result
}

module.exports = build
