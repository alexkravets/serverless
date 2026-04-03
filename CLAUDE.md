# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run build        # Compile TypeScript (src/ → dist/)
npm test             # Run Jest unit tests
npm run lint         # ESLint with auto-fix on src/ and bin/
npm run prepublishOnly  # Runs build before npm publish (automatic)
```

## Architecture

This is `@kravc/serverless` v2, a dev-dependency CLI tool for [@kravc/dos](https://github.com/alexkravets/dos) services. It generates a CloudFormation template from environment-specific config and deploys via AWS SDK — no Serverless Framework dependency.

### Source layout

- `src/constants.ts` — shared constants (`DEFAULT_SERVICE`, `DEFAULT_TABLE`, `DEFAULT_RUNTIME`, `DEFAULT_TIMEOUT`, `DEFAULT_MEMORY`, etc.)
- `src/getConfig.ts` — `Config`/`DynamoTableConfig` interfaces; `getConfig(env?)` sets env vars and loads the `config` package
- `src/getDeploymentMeta.ts` — `DeploymentMeta` interface; `getDeploymentMeta(config)` returns `{ stackName, region, profile }`
- `src/build.ts` — `build(config)` returns a CloudFormation template object
- `src/index.ts` — public re-exports from all modules
- `src/deploy.ts` — CLI logic: zip project, upload to S3, create/execute CloudFormation change set
- `src/deleteStack.ts` — CLI logic: empty and delete the S3 deployment bucket, then delete the CloudFormation stack
- `src/info.ts` — CLI logic: describe CloudFormation stack outputs
- `src/logs.ts` — CLI logic: poll CloudWatch Logs and stream to stdout

TypeScript source compiles to `dist/` (not tracked in git, published to npm via `prepublishOnly`).

### bin/ script

Single entry point `bin/sls.js` — accepts `sls <command> [env]`:

- `sls build [env]` — generates `template.yaml` + `.deployment` (for inspection)
- `sls deploy [env]` → `dist/deploy.main(env)`
- `sls delete [env]` → `dist/deleteStack.default(env)` — empties deployment bucket then deletes the stack
- `sls info [env]` → `dist/info.main(env)`
- `sls logs [env]` → `dist/logs.main(env)`

Sets `NODE_ENV=serverless` and `NODE_APP_INSTANCE={env}` before loading any modules.

### Config convention in consuming projects

Environment config lives in `config/serverless-{env}.yaml` in the consuming project. The `config` npm package resolves it via `NODE_ENV=serverless` + `NODE_APP_INSTANCE={env}`, which the bin scripts set before loading config.

### CloudFormation template structure

`build()` generates a template with these resources: `LambdaRole` (IAM), `ApiLogGroup` (CloudWatch Logs), `ApiFunction` (Lambda, named `{service}-{env}` — no `-api` suffix), `RestApi` (API Gateway REST/EDGE), `ApiGatewayRequestValidator`, `OperationResource` (`/{operationId}`), six HTTP methods (GET `/`, GET/POST/PATCH/DELETE/OPTIONS `/{operationId}`), `ApiDeployment`, `ApiStage`, `ApiGatewayPermission`.

Outputs: `ApiEndpoint`, `FunctionName`, `FunctionArn`.

### Code style

ESLint enforces semicolons and single quotes. TypeScript strict mode is enabled.
