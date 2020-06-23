'use strict'

const get  = require('lodash.get')
const pick = require('lodash.pick')

const ROOT_PATH = process.cwd()
const { name }  = require(`${ROOT_PATH}/package.json`)
const DEFAULT_SERVICE = name.split('/')[1] ? name.split('/')[1] : name

const build = config => {
  const result = pick(config, [
    'service',
    'provider',
    'plugins',
    'custom',
    'package',
    'functions',
    'resources',
    'authorizer'
  ])

  result.service = result.service || DEFAULT_SERVICE

  result.functions = result.functions || {}
  result.functions.api = {
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

  for (const method of [ 'get', 'post', 'patch', 'delete', 'options' ]) {
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

  result.provider.iamRoleStatements = get(result, 'provider.iamRoleStatements', [])

  const hasTables = config.tables

  if (!hasTables) {
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

  for (const tableConfig of config.tables) {
    const { name: tableName, actions = DEFAULT_TABLE_ACTIONS } = tableConfig

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
