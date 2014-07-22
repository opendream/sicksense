ALTER TABLE symptoms ADD COLUMN "isILI" boolean DEFAULT false;
ALTER TABLE symptoms ADD COLUMN "predefined" boolean DEFAULT false;

-- ADD INDEX to ililog
CREATE INDEX ON ililog (source, date, year, week);
