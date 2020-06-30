#!/bin/sh

NODE_ENV=serverless
NODE_APP_INSTANCE="$@"
NODE_APP_INSTANCE=${NODE_APP_INSTANCE:-dev}

SLS="./node_modules/.bin/sls"
BUILD_PATH="./node_modules/.bin/build"

NODE_ENV="$NODE_ENV" \
NODE_APP_INSTANCE="$NODE_APP_INSTANCE" \
  $BUILD_PATH && $SLS info
