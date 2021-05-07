#!/usr/bin/env node

'use strict'

const fs        = require('fs')
const config    = require('config')
const { dump }  = require('js-yaml')
const { build } = require('../src')

const main = () => {
  const input = JSON.parse(JSON.stringify(config))

  const result = build(input)
  const yaml   = dump(result)

  fs.writeFileSync('serverless.yaml', yaml)
}

main()
