ALTER TABLE reports ADD COLUMN is_sicksense boolean NOT NULL DEFAULT 't';
CREATE INDEX reports_is_sicksense ON reports ( is_sicksense );

ALTER TABLE symptoms_summary_by_week ADD COLUMN is_sicksense boolean NOT NULL DEFAULT 't';
DROP INDEX symptoms_summary_by_week_location_id_symptom_id_year_week_idx;
CREATE INDEX symptoms_summary_by_week_index_1 ON symptoms_summary_by_week ( location_id, symptom_id, year, week, is_sicksense );
