-- REPORTS
CREATE OR REPLACE FUNCTION "update_summary_for_dashboard"() RETURNS trigger AS
$BODY$

DECLARE
  finecount integer;
  sickcount integer;
  ilicount integer;
  ili_to_increase integer;

BEGIN

  ili_to_increase := 0;

  IF TG_OP = 'INSERT' THEN
    RAISE NOTICE 'TRIGGER INSERT called on %', TG_TABLE_NAME;

    SELECT COUNT(id) INTO finecount
    FROM reports 
    WHERE "isFine" = true
          AND year = NEW.year
          AND week = NEW.week
          AND "userId" = NEW."userId"
          AND location_id = NEW."location_id";

    SELECT COUNT(id) INTO sickcount
    FROM reports 
    WHERE "isFine" = false
          AND year = NEW.year
          AND week = NEW.week
          AND "userId" = NEW."userId"
          AND location_id = NEW."location_id";

    SELECT COUNT(id) INTO ilicount
    FROM reports 
    WHERE "isILI" = true
          AND year = NEW.year
          AND week = NEW.week
          AND "userId" = NEW."userId"
          AND location_id = NEW."location_id";

    -- also update ili count
    IF ilicount > 1 THEN
      RAISE NOTICE 'DO NOTHING';
    ELSE
      IF NEW."isILI" = true THEN
        RAISE NOTICE 'INCREASE ili_count';
        ili_to_increase := 1;
      END IF;
    END IF;

    RAISE NOTICE 'FINECOUNT %', finecount;
    RAISE NOTICE 'SICKCOUNT %', sickcount;

    IF NEW."isFine" = false THEN
      -- IF sick then
      IF sickcount > 1 THEN
        -- number except more than 1 show that there is already sicked report.
        RAISE NOTICE '--> DO NOTHING';
      ELSE
        -- check if any sick this week, 1 mean itself, 0 will never happen.
        RAISE NOTICE '--> INCREASE sick STAT';
        -- check if any find this week
        IF finecount > 0 THEN
          -- if found, decrease it.
          RAISE NOTICE '----> DECREASE find STAT';

          WITH "update_summary" AS (
            UPDATE reports_summary_by_week
            SET sick = sick + 1, fine = fine - 1, ili_count = ili_count + ili_to_increase
            WHERE location_id = NEW.location_id AND year = NEW.year AND week = NEW.week
            RETURNING *
          )
          INSERT INTO reports_summary_by_week (location_id, year, week, fine, sick, ili_count)
          SELECT NEW.location_id, NEW.year, NEW.week, 0, 1, ili_to_increase
          WHERE NOT EXISTS ( SELECT * FROM "update_summary" );

        ELSE
          WITH "update_summary" AS (
            UPDATE reports_summary_by_week
            SET sick = sick + 1, ili_count = ili_count + ili_to_increase
            WHERE location_id = NEW.location_id AND year = NEW.year AND week = NEW.week
            RETURNING *
          )
          INSERT INTO reports_summary_by_week (location_id, year, week, fine, sick, ili_count)
          SELECT NEW.location_id, NEW.year, NEW.week, 0, 1, ili_to_increase
          WHERE NOT EXISTS ( SELECT * FROM "update_summary" );

        END IF;
      END IF;

    ELSE
      -- IF this report is not sick.
      IF sickcount > 0 THEN
        -- when any sick found, just do nothing
        RAISE NOTICE '--> DO NOTHING';
      ELSE
        -- else, check if there's already fine count.
        IF finecount > 1 THEN
          -- if yes, do nothing.
          RAISE NOTICE '----> DO NOTHING';
        ELSE
          -- if not, increase fine stat.
          RAISE NOTICE '----> INCREASE find STAT';

          WITH "update_summary" AS (
            UPDATE reports_summary_by_week
            SET fine = fine + 1
            WHERE location_id = NEW.location_id AND year = NEW.year AND week = NEW.week
            RETURNING *
          )
          INSERT INTO reports_summary_by_week (location_id, year, week, fine, sick)
          SELECT NEW.location_id, NEW.year, NEW.week, 1, 0
          WHERE NOT EXISTS ( SELECT * FROM "update_summary" );

        END IF;
      END IF;
    END IF;

  END IF;

  RETURN NEW;

END;

$BODY$
  LANGUAGE plpgsql;

CREATE TRIGGER update_summary_for_dashboard
AFTER INSERT
ON reports
FOR EACH ROW
EXECUTE PROCEDURE update_summary_for_dashboard();



-- SYMPTOMS
CREATE OR REPLACE FUNCTION "update_symptoms_summary_for_dashboard"() RETURNS trigger AS
$BODY$

DECLARE
  report_row RECORD;
  symptom_count integer;

BEGIN

  IF TG_OP = 'INSERT' THEN
    RAISE NOTICE 'TRIGGER INSERT called on %', TG_TABLE_NAME;

    SELECT * INTO report_row
    FROM reports
    WHERE id = NEW."reportId";

    SELECT COUNT(rs.id) INTO symptom_count
    FROM reportssymptoms rs
         INNER JOIN reports r ON r.id = rs."reportId"
    WHERE r."userId" = report_row."userId" AND
          rs."symptomId" = NEW."symptomId" AND
          year = report_row.year AND
          week = report_row.week;

    IF symptom_count > 1 THEN
      -- IF FOUND DO NOTHING
      RAISE NOTICE 'FOUND %', symptom_count;
    ELSE
      -- ELSE INCREASE SYMPTOM COUNT
      RAISE NOTICE 'NOT FOUND, INCREASE';

      WITH "update_symptoms_summary" AS (
        UPDATE symptoms_summary_by_week
        SET count = count + 1
        WHERE location_id = report_row.location_id AND
              symptom_id = NEW."symptomId" AND
              year = report_row.year AND
              week = report_row.week
        RETURNING *
      )
      INSERT INTO symptoms_summary_by_week (location_id, symptom_id, year, week, count)
      SELECT report_row.location_id, NEW."symptomId", report_row.year, report_row.week, 1
      WHERE NOT EXISTS ( SELECT * FROM "update_symptoms_summary" );

    END IF;

    RAISE NOTICE 'SYMPTOM ID is %', NEW."symptomId";

  END IF;

  RETURN NEW;

END;

$BODY$
  LANGUAGE plpgsql;

CREATE TRIGGER update_symptoms_summary_for_dashboard
AFTER INSERT
ON reportssymptoms
FOR EACH ROW
EXECUTE PROCEDURE update_symptoms_summary_for_dashboard();

