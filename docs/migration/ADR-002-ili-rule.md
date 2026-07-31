# ADR-002: ILI classification rule

## Status

**Accepted** — code is source of truth.

## Decision

A report is ILI when **any** of the submitted symptoms intersects the configured ILI set.

## Rule (runtime)

Source: `api/services/ReportService.js` create path; `config/symptoms.js`.

```text
ILISymptoms = ["fever", "cough", "sore-throat"]
isILI = non-empty intersection(report.symptoms, ILISymptoms)
```

**Not** “fever AND (cough OR sore-throat)”.

## Consequences

- Python must implement **any-of** matching against the same slug set (or equivalent config).
- External write-ups that use classic WHO-style “fever + respiratory” must not override this without a product decision and mobile impact review.
- DB triggers / summary tables may also encode ILI counting; re-check `db/3_reports_procedure.sql` and `db/16_update_trigger_on_tables.sql` during schema port.
