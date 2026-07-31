# @messaging-app/api-types

Shared TypeScript types generated from the API's OpenAPI document. Nothing
in this package is hand-written; do not edit `src/index.ts` directly.

## Regenerating

From the repository root, with dependencies installed:

```powershell
pnpm generate:api-types
```

This runs two steps:

1. `@messaging-app/api` boots a Nest application context (no HTTP listener,
   no database connection) and writes its OpenAPI document to
   `openapi.json` in this package.
2. `openapi-typescript` converts `openapi.json` into `src/index.ts`.

`openapi.json` is a generated build artifact and is gitignored;
`src/index.ts` is committed so consumers can import types without running
the generator first, and should be regenerated whenever the API contract
changes.
