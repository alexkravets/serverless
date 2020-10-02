# @kravc/serverless

Serverless configuration builder and deployment tool for
[@kravc/dos](https://github.com/alexkravets/dos) service.

Install:

```sh
npm i --save-dev @kravc/serverless
```

Environment specific configurations should be added via `config/serverless-*.yaml`
files, e.g. `config/serverless-dev.yaml`.

## Scripts

Deploy service to specific environment (e.g. `stg`, default: 'dev'):

```sh
npx deploy [ENV]
```

Show service details for specific environment (e.g. `stg`, default:
`dev`):

```sh
npx info [ENV]
```

Show service logs for specific environment (e.g. `stg`, default:
`dev`):

```sh
npx logs [ENV]
```
