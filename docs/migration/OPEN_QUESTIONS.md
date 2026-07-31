# Open questions from code sweep + multi-reviewer synthesis

Updated after independent Grok report + Fable Max + Codex Sol Ultra review.

## Blockers for cutover (need production truth)

1. **Deployed route map**  
   Confirm how (if at all) production exposes `POST /login`, `GET /reports`, `GET /dashboard` (controller `index` exists, only `GET /dashboard/now` is routed). Blueprints are off.  
   **Verify:** nginx/proxy config, access logs, mobile traffic.

2. **Global Flu View / external aggregators**  
   Paths such as `/globalfluview/api/weeks/` and `/globalfluview/api/surveys/{week_id}/` are **not** in this repo. Live host may use host-wide basic auth (not GFV-specific).  
   **Verify:** reverse proxy upstreams, separate services, authenticated fixtures — do **not** invent endpoints.

3. **Active consumers & app versions**  
   DoctorMe / sicksense-web / external networks. Needed before changing `userReports` or dual-identity rules.

4. **Password hashing bit-compat**  
   `password-hash-and-salt` with `sails.config.session.secret` as salt argument. Must match bit-exact at cutover or all logins fail.  
   **Verify:** golden hash fixtures from known password + secret.

5. **Week / timezone**  
   `moment(startedAt).week()` (locale-dependent) drives `year`/`week` on reports and summaries. Python ISO week may skew dashboards.  
   **Verify:** unit fixtures for boundary dates (Bangkok TZ).

## Contract / inventory quality

6. **Error wire format**  
   400 often has rich `meta`; 404/500 may not share the same envelope (see `api/responses/*`). Need golden captures.

7. **Apiary drift**  
   `apiary.apib` documents some routes/tests that disagree with `routes.js` (e.g. `GET /reports/{id}`). Treat as **stale evidence**, not law.

8. **Trigger semantics**  
   Summary tables updated by plpgsql; fine/sick exclusivity per user/week/location may live in triggers. Port or replace only after reading `db/3_*` and `db/16_*`.

## Product decisions (ADRs)

| Topic | Doc | Status |
|-------|-----|--------|
| `userReports` global page vs filter by user | [ADR-001](./ADR-001-userReports-behavior.md) | Doc accepted; fix-vs-parity open |
| ILI any-of vs fever+respiratory | [ADR-002](./ADR-002-ili-rule.md) | **Code rule accepted** |
| Dual-write cutover | — | Prefer **single writer** + shadow reads (Codex); avoid nginx dual-write for POST health data |
