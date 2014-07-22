DROP TABLE reports_summary_by_week;
CREATE TABLE reports_summary_by_week
(
  location_id integer,
  year smallint,
  week smallint,
  fine integer DEFAULT 0,
  sick integer DEFAULT 0,
  ili_count integer DEFAULT 0
);
CREATE INDEX ON reports_summary_by_week ( location_id, year, week );

DROP TABLE symptoms_summary_by_week;
CREATE TABLE symptoms_summary_by_week
(
  location_id integer,
  symptom_id integer,
  year smallint,
  week smallint,
  count integer DEFAULT 0
);
CREATE INDEX ON symptoms_summary_by_week ( location_id, symptom_id, year, week );

-- ALTER TABLE reports
ALTER TABLE reports ADD COLUMN year smallint;
ALTER TABLE reports ADD COLUMN week smallint;
ALTER TABLE reports ADD COLUMN "isILI" boolean DEFAULT false;
ALTER TABLE reports ADD COLUMN location_id integer;
ALTER TABLE reports ALTER COLUMN subdistrict TYPE varchar(255);
ALTER TABLE reports ALTER COLUMN district TYPE varchar(255);
ALTER TABLE reports ALTER COLUMN city TYPE varchar(255);
CREATE INDEX ON reports ( id, year, week, "startedAt", "userId", "isFine", "isILI" );
CREATE INDEX ON reports ( location_id );
UPDATE reports SET year = EXTRACT(YEAR FROM "startedAt"), week = EXTRACT(WEEK FROM "startedAt");

-- ALTER TABLE locations
ALTER TABLE locations ADD COLUMN zipcode varchar(5);
ALTER TABLE locations ALTER COLUMN code TYPE varchar(255);
ALTER TABLE locations ALTER COLUMN tambon_th TYPE varchar(255);
ALTER TABLE locations ALTER COLUMN tambon_en TYPE varchar(255);
ALTER TABLE locations ALTER COLUMN amphoe_th TYPE varchar(255);
ALTER TABLE locations ALTER COLUMN amphoe_en TYPE varchar(255);
ALTER TABLE locations ALTER COLUMN province_th TYPE varchar(255);
ALTER TABLE locations ALTER COLUMN province_en TYPE varchar(255);
CREATE INDEX on locations ( id, province_th, province_en, lower(province_en) );
