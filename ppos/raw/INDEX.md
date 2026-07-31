# Source Registry

This registry links the **legacy artifacts** to reverse-engineer — modules, database schemas, stored procedures, screens, and legacy docs. Do not copy them here — link to each artifact and record what has and has not been recovered.

## Source Map

<!-- Seeded at instantiation. One row per source artifact. -->

| ID | Title | Source Path | Status |
|---|---|---|---|
| LEG-APIARY | API Blueprint (Apiary) | [../apiary.apib](../apiary.apib) | linked |
| LEG-ROUTES | Route mappings | [../config/routes.js](../config/routes.js) | linked |
| LEG-POLICIES | Auth / policy stack | [../config/policies.js](../config/policies.js) | linked |
| LEG-CTRL-USERS | Users controller | [../api/controllers/UsersController.js](../api/controllers/UsersController.js) | unreviewed |
| LEG-CTRL-LOGIN | Login controller | [../api/controllers/LoginController.js](../api/controllers/LoginController.js) | unreviewed |
| LEG-CTRL-REPORTS | Reports controller | [../api/controllers/ReportsController.js](../api/controllers/ReportsController.js) | unreviewed |
| LEG-CTRL-DASH | Dashboard controller | [../api/controllers/DashboardController.js](../api/controllers/DashboardController.js) | unreviewed |
| LEG-CTRL-NEWS | News controller | [../api/controllers/NewsController.js](../api/controllers/NewsController.js) | unreviewed |
| LEG-CTRL-NOTIF | Notifications controller | [../api/controllers/NotificationsController.js](../api/controllers/NotificationsController.js) | unreviewed |
| LEG-CTRL-EMAIL | Email subscriptions controller | [../api/controllers/EmailSubscriptionsController.js](../api/controllers/EmailSubscriptionsController.js) | unreviewed |
| LEG-CTRL-OTT | Onetime token controller | [../api/controllers/OnetimeTokenController.js](../api/controllers/OnetimeTokenController.js) | unreviewed |
| LEG-CTRL-CRON | Cron controller | [../api/controllers/CronController.js](../api/controllers/CronController.js) | unreviewed |
| LEG-SVC-USER | User service | [../api/services/UserService.js](../api/services/UserService.js) | unreviewed |
| LEG-SVC-REPORT | Report service | [../api/services/ReportService.js](../api/services/ReportService.js) | unreviewed |
| LEG-SVC-TOKEN | Access token service | [../api/services/AccessTokenService.js](../api/services/AccessTokenService.js) | unreviewed |
| LEG-SVC-OTT | Onetime token service | [../api/services/OnetimeTokenService.js](../api/services/OnetimeTokenService.js) | unreviewed |
| LEG-SVC-NOTIF | Notifications service | [../api/services/NotificationsService.js](../api/services/NotificationsService.js) | unreviewed |
| LEG-SVC-LOC | Location service | [../api/services/LocationService.js](../api/services/LocationService.js) | unreviewed |
| LEG-SVC-DB | DB service | [../api/services/DBService.js](../api/services/DBService.js) | unreviewed |
| LEG-MODEL-AT | AccessToken model | [../api/models/AccessToken.js](../api/models/AccessToken.js) | unreviewed |
| LEG-MODEL-ILI | ILILog model | [../api/models/ILILog.js](../api/models/ILILog.js) | unreviewed |
| LEG-MODEL-SYM | Symptoms model | [../api/models/Symptoms.js](../api/models/Symptoms.js) | unreviewed |
| LEG-DB-CORE | Core schema (users, reports, locations) | [../db/1_add_tables.sql](../db/1_add_tables.sql) | unreviewed |
| LEG-DB-IDX | Indexes + additional tables | [../db/2_add_tables_and_create_index.sql](../db/2_add_tables_and_create_index.sql) | unreviewed |
| LEG-DB-RPT-PROC | Reports stored procedures | [../db/3_reports_procedure.sql](../db/3_reports_procedure.sql) | unreviewed |
| LEG-DB-TOKEN | Access token table | [../db/6_add_accesstoken_table.sql](../db/6_add_accesstoken_table.sql) | unreviewed |
| LEG-DB-SICKSENSE | Sicksense account table | [../db/18_add_sicksense_table.sql](../db/18_add_sicksense_table.sql) | unreviewed |
| LEG-DB-ILI | ILI log table | [../db/41_create_ililog.sql](../db/41_create_ililog.sql) | unreviewed |
| LEG-DB-MIGRATIONS | Remaining SQL migrations (4–22, 42) | [../db/](../db/) | unreviewed |
| LEG-CFG-SYMPTOMS | Symptoms config | [../config/symptoms.js](../config/symptoms.js) | unreviewed |
| LEG-TESTS | Mocha controller/service tests | [../test/](../test/) | unreviewed |

## Errata

<!-- Record source issues, clarifications, or contradictions here. -->

None recorded yet.

## Attachments

<!-- Optional: link diagrams, screenshots, or sample data. -->

None yet.
