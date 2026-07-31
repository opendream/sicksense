# Shared response envelope

Source: `api/responses/ok.js` and siblings (`badRequest`, `forbidden`, `notFound`, `serverError`, `conflict`).

## Success (HTTP 200)

```json
{
  "meta": { "status": 200 },
  "response": { }
}
```

`response` is whatever the controller passes to `res.ok(data)`.

## Client errors (typical)

Controllers often return:

```json
{
  "meta": {
    "status": 400,
    "errorType": "Bad Request",
    "errorMessage": "<user-facing Thai or English>",
    "developerMessage": "...",
    "invalidFields": { }
  }
}
```

Exact fields vary by response helper; parity requires matching each helper in `api/responses/`.

| Status | Helper | Typical use |
|--------|--------|-------------|
| 400 | `res.badRequest` | Validation (`express-validator`) |
| 403 | `res.forbidden` | Auth failures, wrong token, bad credentials |
| 404 | `res.notFound` | Missing news / notification |
| 409 | `res.conflict` | Duplicate registration |
| 500 | `res.serverError` | Unexpected / DB errors |

Many error messages are **Thai** (and some English). Preserve strings for client display parity.

## Auth transport (global)

| Mechanism | How | Used by |
|-----------|-----|---------|
| User access token | Query `?accessToken=<token>` | `tokenAuth`, `optionalTokenAuth` |
| Shared server token | Query `?token=<shared>` | `sharedToken` (admin/cron/news write) |
| Mailgun token | Query `?token=<mailgun.token>` | email hooks/send |

**Note:** Access tokens are **not** Bearer headers in this API; they are query params.
