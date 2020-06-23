#!/usr/bin/env node

'use strict'

const fs        = require('fs')
const config    = require('config')
const { build } = require('../src')
const { safeDump: dump } = require('js-yaml')

const main = () => {
  const input = JSON.parse(JSON.stringify(config))

  const result = build(input)
  const yaml   = dump(result)

  fs.writeFileSync('serverless.yaml', yaml)
}

main()
