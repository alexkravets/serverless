'use strict'

const get       = require('lodash.get')
const pick      = require('lodash.pick')
const cloneDeep = require('lodash.clonedeep')

class Serverless {
  constructor(app) {
    this._config     = cloneDeep(app.composer.config)
    this._components = app.composer.components
  }

  build() {
    const config = pick(this._config, [
      'service',
      'provider',
      'plugins',
      'custom',
      'package',
      'functions',
      'resources',
      'authorizer'
    ])

    config.functions = config.functions || {}
    config.functions.api = {
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

      config.functions.api.events.push({ http })
    }

    config.provider.iamRoleStatements = get(config, 'provider.iamRoleStatements', [])

    const tableNames = {}

    for (const name in this._components) {
      const { tableName } = this._components[name]

      if (!tableName) { continue }

      tableNames[tableName] = {
        Effect: 'Allow',
        Action: [
          'dynamodb:Query',
          'dynamodb:Scan',
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem'
        ],
        Resource: [
          `arn:aws:dynamodb:\${opt:region, self:provider.region}:*:table/${tableName}`,
          `arn:aws:dynamodb:\${opt:region, self:provider.region}:*:table/${tableName}/*`
        ]
      }
    }

    const hasTables = Object.keys(tableNames).length > 0

    if (hasTables) {
      const iamRoleStatements = Object.values(tableNames)
      config.provider.iamRoleStatements =
        config.provider.iamRoleStatements.concat(iamRoleStatements)
    }

    return config
  }
}

module.exports = Serverless
