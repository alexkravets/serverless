'use strict'

const get = require('lodash.get')

const NODE_ENV   = process.env.NODE_ENV || 'serverless'
const INSTANCE   = process.env.NODE_APP_INSTANCE || 'localhost'
const ROOT_PATH  = process.cwd()
const { name }   = require(`${ROOT_PATH}/package.json`)
const DEFAULT_SERVICE = name.replace('@', '').replace('/', '-')

const build = config => {
  const AWS = get(config, 'aws', {})
  const SERVERLESS = get(config, 'serverless', {})

  const result = {
    service: SERVERLESS.service || DEFAULT_SERVICE
  }

  result.provider = {
    name:    'aws',
    stage:   INSTANCE,
    runtime: 'nodejs12.x',
    environment: {
      NODE_PATH:         './',
      NODE_APP_INSTANCE: INSTANCE,
      NODE_ENV
    },
    iamRoleStatements: [{
      Effect: 'Allow',
      Action: [
        'lambda:InvokeFunction',
        'lambda:InvokeAsync',
        'lambda:Invoke'
      ],
      Resource: '*'
    }]
  }

  if (AWS.region) {
    result.provider.region = AWS.region
  }

  if (AWS.profile) {
    result.provider.profile = AWS.profile
  }

  result.package = {
    exclude: ['test/**', 'bin/**']
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

  const TABLES = get(config, 'tables')

  if (!TABLES) {
    return result
  }

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

  return result
}

module.exports = build
