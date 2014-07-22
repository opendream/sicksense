SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS ililog (
    source text,
    date timestamp with time zone,
    year integer,
    week integer,
    value double precision,
    id integer NOT NULL,
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone
);

ALTER TABLE ONLY ililog
    ADD CONSTRAINT ililog_pkey PRIMARY KEY (id);

CREATE INDEX ililog_source_date_year_week_idx ON ililog USING btree (source, date, year, week);
