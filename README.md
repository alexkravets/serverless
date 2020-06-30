# @kravc/serverless

Serverless configuration builder for `@kravc/dos` service.

## API

Install:

```sh
npm i --save-dev @kravc/serverless
```

Add deployment scripts to `package.json` for environments:

```json
  "scripts": {
    "dev:deploy": "deploy dev",
    "dev:info": "info dev",
    "dev:logs": "logs dev",
```

Available **npm** scripts:

- `build` — build `serverless.yaml` deployment configuration file
- `deploy [ENV]` — deploy service to specified environment, e.g. `stg`
  (default: `dev`)
- `info [ENV]` — show information about deployed lamda function for
  specified environment, e.g. `stg` (default: `dev`)
- `logs [ENV]` — show logs from deployed lamda function for specified
  environment, e.g. `stg` (default: `dev`)

Environment specific configurations could be added via `config/serverless-*.yaml`
files, e.g. `config/serverless-dev.yaml`
