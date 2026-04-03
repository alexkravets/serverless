# @kravc/serverless

CloudFormation-based deployment tool for [@kravc/dos](https://github.com/alexkravets/dos) services. Generates a CloudFormation template from environment-specific config and deploys via AWS SDK — no Serverless Framework required.

## Install

```sh
npm i --save-dev @kravc/serverless
```

**Requirements:** AWS CLI credentials configured (via profile in `~/.aws/credentials` or environment variables such as `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`).

## Scripts

```sh
npx sls deploy [ENV]    # deploy to environment (default: dev)
npx sls info   [ENV]    # show stack status and endpoint URL
npx sls logs   [ENV]    # tail Lambda logs
npx sls build  [ENV]    # generate template.yaml and .deployment locally
```

## Configuration

Place environment-specific config in `config/serverless-{env}.yaml` (e.g. `config/serverless-dev.yaml`). The [`config`](https://www.npmjs.com/package/config) package resolves the file using `NODE_ENV=serverless` and `NODE_APP_INSTANCE={env}`.

### Full config example

```yaml
aws:
  region: us-east-1
  profile: default          # omitted automatically in CI (GITHUB_ACTIONS env var)

serverless:
  service: my-service-v1    # optional — defaults to package name + major version
  timeout: 30               # Lambda timeout in seconds (default: 6)
  memorySize: 512           # Lambda memory in MB (default: 1024)
  environment:              # additional Lambda environment variables
    SOME_KEY: some-value
  iamRoleStatements:        # additional IAM statements (e.g. S3 access)
    - Effect: Allow
      Action:
        - s3:GetObject
        - s3:PutObject
      Resource: arn:aws:s3:::my-bucket/*

dynamodb:
  name: my-table            # deployed as my-table-{env}
  actions:                  # optional — override default DynamoDB actions
    - dynamodb:Query
    - dynamodb:GetItem
```


## Build artifacts

Each `build` or `deploy` writes artifacts into `.serverless/` in the project root:

- `.serverless/template.yaml` — generated CloudFormation template
- `.serverless/.deployment` — deployment metadata (stack name, region, profile)

Add `.serverless/` to `.gitignore`:

```
.serverless/
```

## License

ISC

---

Revision: April 2, 2026<br/>
By: Alex Kravets (@alexkravets)
