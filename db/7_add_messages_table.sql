SET client_encoding = 'UTF8';

CREATE TABLE notifications (
    id serial NOT NULL,
    "published" timestamp with time zone,
    "body" text NOT NULL,
    "is_custom_sql" BOOLEAN NOT NULL DEFAULT 'f',
    "gender" smallint DEFAULT 0,
    "age_start" smallint DEFAULT 0,
    "age_stop" smallint DEFAULT 120,
    "province" varchar(100),
    "crondata" json,
    "status" smallint DEFAULT 0,
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone
);

CREATE INDEX ON notifications USING btree (published, gender, age_start, age_stop, province);
