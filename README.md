# @kravc/serverless

Serverless configuration builder for `@kravc/dos` service.

## API

Install:

```sh
npm i --save-dev @kravc/serverless
```

Add `build` script to `package.json`:

```json
"scripts": {
  "build": "NODE_ENV=lambda npm run build",
  "dev:deploy": "NODE_APP_INSTANCE=dev npm run build && sls deploy"
}
```
