# API inventory (high-level inputs / outputs)

**Sources:** `config/routes.js`, `config/policies.js`, controllers under `api/controllers/`, services, `apiary.apib`, mocha tests.

**Envelope:** see [RESPONSE_ENVELOPE.md](./RESPONSE_ENVELOPE.md).

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

**Input (body JSON)**

| Field | Required | Notes |
|-------|----------|--------|
| `uuid` | soft | Device id; if missing, derived from email local-part (legacy ≤4.1) |
| `email` | for sicksense account | Real email when creating/linking sicksense ID |
| `password` | with real email | Account password |
| `tel` | yes (validated) | Phone |
| `gender` | yes | `male` / `female` |
| `birthYear` | yes | CE year |
| `address.subdistrict` | yes | |
| `address.district` | yes | |
| `address.city` | yes | |
| `location.latitude` / `longitude` | optional | GPS; stored as Point 4326 |
| `platform` | optional | body or query; default `doctormeios` |
| `deviceToken` | optional | Push device id; `""` clears |
| `subscribe` | optional | email subscription after register |

**Output (200)**  
User JSON (`formattedUser` / `getUserJSON`) plus `accessToken` (and often `deviceToken`).

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

### `GET /users/:id/reports` — user report history

| | |
|--|--|
| **Auth** | accessToken |
| **Controller** | `UsersController.userReports` |

**Input:** path `id`; query `accessToken`, `offset` (default 0), `limit` (default 10).  
**Output:** paginated reports for that user (report JSON list).

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

**Server-derived:** `userId`, address from user, `location_id` from address lookup, `isILI` from symptom config, `is_anonymous` / `sicksense_id` from account link, week/year.

**Output:** report JSON (`ReportService.getReportJSON`).

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

**Output:** aggregated ILI / summary stats for location + period (fine/sick/ILI counts, charts data). Exact keys in controller return object — preserve in OpenAPI later.

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
