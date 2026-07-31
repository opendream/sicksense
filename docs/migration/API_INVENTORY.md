# API inventory (high-level inputs / outputs)

**Sources:** `config/routes.js`, `config/policies.js`, controllers under `api/controllers/`, services, `apiary.apib`, mocha tests.

**Review:** Corrected after independent Grok report + Fable Max + Codex Sol Ultra (see [REVIEW_SYNTHESIS.md](./REVIEW_SYNTHESIS.md)).

**Envelope:** see [RESPONSE_ENVELOPE.md](./RESPONSE_ENVELOPE.md).  
**ADRs:** [userReports](./ADR-001-userReports-behavior.md), [ILI rule](./ADR-002-ili-rule.md).

**Legend**

| Auth | Meaning |
|------|---------|
| public | No token |
| accessToken | `?accessToken=` → user session (`tokenAuth`) |
| optionalAccessToken | `?accessToken=` optional (`optionalTokenAuth`) |
| sharedToken | `?token=` server shared secret (`sharedToken`) |
| mailgunToken | `?token=` mailgun webhook secret |

---

## 1. Users & registration

### `POST /users` — register (device ± sicksense account)

| | |
|--|--|
| **Auth** | public |
| **Controller** | `UsersController.create` |

**Dual identity (important)**  
- Device row in `users` often uses synthetic email `{uuid}@sicksense.com` (password derived from uuid).  
- Optional real **Sicksense account** email/password lives in `sicksense` + link table `sicksense_users`.  
- If `uuid` omitted, code derives uuid from email local-part (legacy pre-4.2 TODO).

**Input (body JSON)** — validation as implemented (`validate()`)

| Field | Required | Notes |
|-------|----------|--------|
| `email` | **yes** | Valid email (also used as sicksense ID when “real” email path) |
| `password` | **yes** | Length 8–64 |
| `uuid` | no | Device id; commented-out required check (pre-4.2 apps) |
| `tel` | no* | Used if present; not hard-required in validate() block |
| `gender` | no | If present: `male` \| `female` |
| `birthYear` | no | If present: int 1900…current year |
| `address` | no | If present: subdistrict, district, city all required + must match `locations` |
| `location` | no | If present: lat/lon required and in range |
| `platform` | optional | body or query; default `doctormeios` |
| `deviceToken` | optional | Push device id; `""` clears |
| `subscribe` | optional | email subscription after register |

\*Demographics may still be written as undefined if omitted — clients usually send them.

**Output (200)**  
User JSON (`formattedUser` / `getUserJSON`) plus `accessToken` (and often `deviceToken`). Linked sicksense email may replace device email in the JSON.

**Errors**  
400 validation; 409 device already registered / email taken; 403 / 500 as coded.

**Side effects**  
Insert `users`, maybe `sicksense` + `sicksense_users`, `accesstoken`, `devices`; may send verification email.

---

### `POST /users/:id` — update profile

| | |
|--|--|
| **Auth** | accessToken (must match `:id`) |
| **Controller** | `UsersController.update` |

**Input**

| Field | Source | Notes |
|-------|--------|--------|
| `id` | path | Must equal token user |
| `accessToken` | query | Required by policy |
| `gender`, `birthYear` | body | optional |
| `address.*` | body | optional partial |
| `location` | body | optional |
| `password` | body | optional password change path |
| `platform` | body/query | |
| `deviceToken` | body | |
| `subscribe` | body | |

**Output**  
Updated user JSON.

---

### `GET /users/:id` — get user

| | |
|--|--|
| **Auth** | accessToken |
| **Controller** | `UsersController.getUser` |

**Input:** path `id`, query `accessToken`.  
**Output:** user JSON (email may be sicksense email if linked).

---

### `GET /users/:id/reports` — report list (auth scoped to user, **data not filtered**)

| | |
|--|--|
| **Auth** | accessToken; token’s `userId` must equal path `:id` |
| **Controller** | `UsersController.userReports` |
| **ADR** | [ADR-001](./ADR-001-userReports-behavior.md) |

**Input:** path `id`; query `accessToken`, `offset` (default 0), `limit` (default 10).

**Actual behavior (parity-critical)**  
SQL selects **all** reports ordered by `createdAt DESC` with limit/offset, and **global** `COUNT(*)`.  
There is **no** `WHERE "userId" = :id`.  

So this is **not** “this user’s history”; it is a **system-wide recent feed**, gated only by “token belongs to `:id`”.

**Output:**

```json
{
  "reports": {
    "count": "<global total>",
    "items": [ /* report JSON + symptoms */ ]
  }
}
```

**Rewrite decision required:** bug-for-bug vs filter by user vs new path (see ADR-001).

---

### `POST /users/:id/change-password`

| | |
|--|--|
| **Auth** | accessToken |
| **Controller** | `UsersController.changePassword` |

**Input:** path `id`; body password fields (old/new — see controller validation).  
**Output:** success user/status.

---

### `POST /users/verify`

| | |
|--|--|
| **Auth** | public |
| **Controller** | `UsersController.verify` |

**Input:** body/token fields for email verification (onetime token flow).  
**Output:** success; marks sicksense verified.

---

### `POST /users/request-verify`

| | |
|--|--|
| **Auth** | public |
| **Controller** | `UsersController.requestVerify` |

**Input:** email / identity for resend verification.  
**Side effect:** email.

---

### `POST /users/forgot-password` / `POST /users/reset-password`

| | |
|--|--|
| **Auth** | public |
| **Controller** | `UsersController.forgotPassword` / `resetPassword` |

**Input:** email; then token + new password.  
**Side effect:** mail + onetime token rows.

---

## 2. Login / account linking

### `POST /connect` — link sicksense account to device

| | |
|--|--|
| **Auth** | optionalAccessToken |
| **Controller** | `LoginController.connect` |

**Input (body)**

| Field | Required |
|-------|----------|
| `email` | yes (email) |
| `password` | yes (≥8) |
| `uuid` | yes |
| `platform` | optional |
| `deviceToken` | optional |

**Output:** user JSON with tokens after link.  
**Errors:** 403 bad credentials / unverified account.

---

### `POST /unlink`

| | |
|--|--|
| **Auth** | accessToken |
| **Controller** | `LoginController.unlink` |

**Input:** authenticated user.  
**Output:** user JSON after unlink from sicksense account.

---

### `POST /login` — **implemented, not in routes.js**

| | |
|--|--|
| **Auth** | public (controller) |
| **Controller** | `LoginController.index` |
| **Evidence** | `test/controllers/LoginController.test.js`, `apiary.apib` |
| **Status** | **OPEN:** blueprints disabled and no explicit route — confirm production binding |

**Input (body):** `email`, `password` (≥8), optional `deviceToken`, `platform`.  
**Output:** user JSON + `accessToken` (+ `deviceToken` if device set).

---

## 3. Reports

### `POST /reports` — create report

| | |
|--|--|
| **Auth** | accessToken |
| **Controller** | `ReportsController.create` |

**Input (body)**

| Field | Required | Notes |
|-------|----------|--------|
| `isFine` | yes | boolean |
| `symptoms` | if not fine | array of symptom slugs |
| `animalContact` | yes | boolean |
| `startedAt` | yes | date; not far future; not before last week Sunday |
| `location.latitude/longitude` | optional | GPS for report point |
| `moreInfo` | optional | text |
| `platform` | optional | body/query |

**Server-derived**

| Field | Rule |
|-------|------|
| `userId` | from token user |
| address fields | from user profile |
| `location_id` | lookup `locations` by address |
| `isILI` | **any** of symptoms ∈ `{fever, cough, sore-throat}` — [ADR-002](./ADR-002-ili-rule.md) |
| `is_anonymous` | `true` unless user has `sicksenseId` **and** `isVerified` |
| `sicksense_id` | if linked |
| `year` / `week` | from `moment(startedAt).week()` (locale-sensitive) |
| geom | from GPS location or address-derived coords |

**Output:** report JSON (`ReportService.getReportJSON`).  
**Side effects:** insert report + reportssymptoms; **plpgsql triggers** update weekly summary tables.

---

### `GET /reports` — list reports (geo optional)

| | |
|--|--|
| **Auth** | public (no policy) |
| **Controller** | `ReportsController.index` |
| **Route** | **Not in routes.js** — tests hit `GET /reports` (**OPEN**) |

**Input (query)**

| Field | Notes |
|-------|--------|
| `offset`, `limit` | default 0 / 10 |
| `sw`, `ne` | lat,lon pairs for bbox; both required together |

**Output:**

```json
{
  "reports": {
    "count": 123,
    "items": [ /* report JSON + symptoms, userAddress, locationByUserAddress */ ]
  }
}
```

---

## 4. Dashboard

### `GET /dashboard/now`

| | |
|--|--|
| **Auth** | public |
| **Controller** | `DashboardController.now` |

**Input (query)**

| Field | Notes |
|-------|--------|
| `city` | province/city name **or** |
| `latitude` + `longitude` | resolve city |
| `date` | optional moment date |
| `includeReports` | optional extra payload |

**Output:** aggregated ILI / summary stats for location + period (fine/sick/ILI counts, charts data from `ililog` BOE + sicksense series). Exact keys in controller return object — preserve in OpenAPI later.

### `GET /dashboard` — **implemented, not in routes.js**

| | |
|--|--|
| **Controller** | `DashboardController.index` |
| **Evidence** | controller + tests/apiary mention |
| **Status** | **OPEN** — same class of anomaly as `/login` and `/reports` |

---

## 5. Notifications (admin)

### `GET /notifications`

| | |
|--|--|
| **Auth** | sharedToken |
| **Controller** | `NotificationsController.index` |

**Input:** query `token`, `offset`, `limit`.  
**Output:** list of notification campaigns.

### `POST /notifications`

| | |
|--|--|
| **Auth** | sharedToken |
| **Controller** | `NotificationsController.create` |

**Input (body):** `published`, `body`, `link`, `gender`, `age_start`, `age_stop`, `city` (stored as province), targeting filters.  
**Side effect:** may trigger push send when published.

### `DELETE /notifications/:notification_id`  
### `POST /notifications/:notification_id/delete`

| | |
|--|--|
| **Auth** | sharedToken + loadNotification |
| **Query** | `permanent` optional |

**Output:** `{ }` success payload / status.

---

## 6. News (CMS)

| Method | Path | Auth | Input | Output |
|--------|------|------|-------|--------|
| POST | `/news` | sharedToken | body `title`, `content` | news row |
| GET | `/news` | public | query `offset`, `limit` | list |
| GET | `/news/:news_id` | public | path id | news or 404 |
| POST | `/news/:news_id` | sharedToken | body title/content | updated row |
| DELETE | `/news/:news_id` | sharedToken | path id | empty ok / 404 |

---

## 7. One-time tokens

### `POST /onetimetoken/validate`

| | |
|--|--|
| **Auth** | public |
| **Controller** | `OnetimeTokenController.validate` |

**Input (body):** `token`, `type` (e.g. verify / reset).  
**Output:** validation result payload.

---

## 8. Email subscription / Mailgun

### `POST /email/hooks`

| | |
|--|--|
| **Auth** | mailgunToken |
| **Controller** | `EmailSubscriptionsController.hooks` |

**Input (body):** Mailgun webhook — `event`, `recipient`, …  
**Output:** ok / forbidden unknown event.  
**Side effect:** update subscription / user email state.

### `GET /email/send`

| | |
|--|--|
| **Auth** | mailgunToken |
| **Controller** | `EmailSubscriptionsController.send` |

**Input:** query-driven send (see controller).  
**Side effect:** outbound mail.

---

## 9. Cron / batch (HTTP)

| Method | Path | Auth | Purpose | Output |
|--------|------|------|---------|--------|
| GET | `/cron/pushnoti` | sharedToken | Push notification batch | ok status object |
| GET | `/cron/email_notification` | sharedToken | Email notification batch | ok / error |

---

## 10. Static / other

| Method | Path | Notes |
|--------|------|--------|
| GET | `/` | Homepage view (EJS), not API envelope |
| OPTIONS | `/*` | CORS preflight 200 |

---

## 11. Not in this repository (do not invent)

### Global Flu View–style paths

Examples cited externally: `/globalfluview/api/weeks/`, `/globalfluview/api/surveys/{week_id}/`.

| Fact | Status |
|------|--------|
| Present in this codebase | **No** (grep empty; blueprints off) |
| Served by this Sails app | **Unproven** |
| Live host auth | May be **host-wide** basic auth (probe carefully); not proof the path is implemented here |

**Action:** resolve via nginx/upstream config and logs before adding any FastAPI routes.

### Apiary-only / stale

| Path | Notes |
|------|--------|
| `GET /reports/{id}` | In apiary; **no** matching controller action wired |

---

## Entity JSON (high level)

### User (`UserService.formattedUser` / `getUserJSON`)

```
id, email, tel, gender, birthYear,
address: { subdistrict, district, city },
location: { latitude, longitude },
platform, isVerified, sicksenseId,
accessToken?, deviceToken?
```

### Report (`ReportService.getReportJSON`)

```
id, isFine, isILI, animalContact, startedAt,
address: { subdistrict, district, city },
locationByAddress: { latitude, longitude },
location: { latitude, longitude },
moreInfo, createdAt, platform,
symptoms?, userAddress?, locationByUserAddress?
```

---

## Route ↔ policy matrix (from config)

| Area | Policy |
|------|--------|
| Default `*` | public (`true`) |
| Reports.create | tokenAuth |
| Users update/get/userReports/changePassword | tokenAuth |
| Users verify/forgot/reset | public |
| Notifications * | sharedToken (+ loadNotification on destroy) |
| News create/update/destroy | sharedToken |
| Cron * | sharedToken |
| Email hooks/send | mailgunToken |
| Login connect | optionalTokenAuth |
| Login unlink | tokenAuth |

---

## Endpoint count (explicit routes.js)

- **Custom routes:** ~28 method+path pairs (including dual delete notification paths).
- **Plus unresolved:** `POST /login`, `GET /reports` (tests/apiary).
- **Blueprints:** disabled — only explicit routes (plus homepage) should be live if config is accurate.
