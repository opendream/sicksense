DROP TRIGGER update_summary_for_dashboard ON reports;

-- REPORTS
CREATE OR REPLACE FUNCTION "update_summary_for_dashboard"() RETURNS trigger AS
$BODY$

DECLARE
  finecount integer;
  sickcount integer;
  ilicount integer;
  ili_to_increase integer;

BEGIN
  finecount := 0;
  sickcount := 0;
  ilicount := 0;
  ili_to_increase := 0;

  IF TG_OP = 'INSERT' THEN
    RAISE NOTICE 'TRIGGER INSERT called on %', TG_TABLE_NAME;

    SELECT id INTO finecount
    FROM reports
    WHERE id != NEW.id AND
          "isFine" = true AND
          year = NEW.year AND
          week = NEW.week AND
          "userId" = NEW."userId" AND
          location_id = NEW."location_id" AND
          is_sicksense = true
    LIMIT 1;

    SELECT id INTO sickcount
    FROM reports
    WHERE id != NEW.id AND
          "isFine" = false AND
          year = NEW.year AND
          week = NEW.week AND
          "userId" = NEW."userId" AND
          location_id = NEW."location_id" AND
          is_sicksense = true
    LIMIT 1;

    RAISE NOTICE 'FINECOUNT %', finecount;
    RAISE NOTICE 'SICKCOUNT %', sickcount;

    IF NEW."isFine" = false THEN

      SELECT id INTO ilicount
      FROM reports
      WHERE id != NEW.id AND
            "isILI" = true AND
            year = NEW.year AND
            week = NEW.week AND
            "userId" = NEW."userId" AND
            location_id = NEW."location_id" AND
            is_sicksense = true
      LIMIT 1;

      -- also update ili count
      IF ilicount != 0 THEN
        RAISE NOTICE 'DO NOTHING';
      ELSE
        IF NEW."isILI" = true THEN
          RAISE NOTICE 'INCREASE ili_count';
          ili_to_increase := 1;
        END IF;
      END IF;

      -- IF sick then
      IF sickcount > 0 THEN
        -- number except more than 1 show that there is already sicked report.
        IF ili_to_increase > 0 THEN
          RAISE NOTICE '--> INCREASING ILI COUNT';

          UPDATE reports_summary_by_week
          SET ili_count = ili_count + ili_to_increase
          WHERE location_id = NEW.location_id AND year = NEW.year AND week = NEW.week;
        ELSE
          RAISE NOTICE '--> DO NOTHING';
        END IF;
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
        IF finecount > 0 THEN
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
WHEN (NEW.is_sicksense is true)
EXECUTE PROCEDURE update_summary_for_dashboard();

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

    -- INCREASE SYMPTOM COUNT
    RAISE NOTICE 'INCREASE';

    WITH "update_symptoms_summary" AS (
      UPDATE symptoms_summary_by_week
      SET count = count + 1, is_sicksense = report_row.is_sicksense
      WHERE location_id = report_row.location_id AND
            symptom_id = NEW."symptomId" AND
            year = report_row.year AND
            week = report_row.week
      RETURNING *
    )
    INSERT INTO symptoms_summary_by_week (location_id, symptom_id, year, week, count, is_sicksense)
    SELECT report_row.location_id, NEW."symptomId", report_row.year, report_row.week, 1, report_row.is_sicksense
    WHERE NOT EXISTS ( SELECT * FROM "update_symptoms_summary" );

  END IF;

  RETURN NEW;

END;

$BODY$
  LANGUAGE plpgsql;
