# Domain ↔ tables (high level)

For Postgres 16/17 + PostGIS migration. Not a full column dump; inventory for rewrite planning.

| Domain | Tables (public) | Notes |
|--------|-----------------|-------|
| Device identity | `users` | Synthetic email often `{uuid}@sicksense.com`; geom Point 4326 |
| Account identity | `sicksense`, `sicksense_users` | Real email/password, verify flag; links many devices → one account |
| Auth | `accesstoken` | Token string + `userId` + `expired` |
| Devices / push | `devices` | device token, platform, subscribe flags |
| Symptoms catalog | `symptoms` | slug/`name`, `isILI`, `predefined` |
| Reports | `reports`, `reportssymptoms` | health reports + M2M symptoms; geom; week/year; ILI flags |
| Locations | `locations` | Thailand admin levels + geom; report `location_id` |
| Aggregates | `reports_summary_by_week`, `symptoms_summary_by_week` | Dashboard rollups / triggers |
| Notifications | (messages/notifications tables) | Targeted push campaigns |
| News | `news` | CMS-like posts |
| Email subscription | `email_subscription` | Mailgun bounce/unsub handling |
| One-time tokens | `onetimetoken` | verify / reset password flows |
| ILI external series | `ililog` | imported ILI values by week |

## Spatial

- SRID **4326**
- User/report points: `Geometry(Point, 4326)` / WKT insert pattern `SRID=4326;POINT(...)`
- Geo filter on reports uses `ST_Within` + polygon from SW/NE corners

## Config-driven domain

| Config | Role |
|--------|------|
| `config/symptoms.js` | Canonical symptom slugs + ILI symptom set |
| `config/session.js` `secret` | Password hashing salt material (`password-hash-and-salt`) |
| `config/sharedTokens` | Server-to-server `token` query values |
| `config/mailgun` | API + webhook token |
