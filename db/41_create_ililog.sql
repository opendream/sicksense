SET client_encoding = 'UTF8';

DROP TABLE ililog;
CREATE TABLE IF NOT EXISTS ililog (
    source text,
    date timestamp with time zone,
    year integer,
    week integer,
    value double precision,
    id serial NOT NULL,
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone
);

ALTER TABLE ONLY ililog
    ADD CONSTRAINT ililog_pkey PRIMARY KEY (id);

CREATE INDEX ON ililog USING btree (source, date, year, week);
