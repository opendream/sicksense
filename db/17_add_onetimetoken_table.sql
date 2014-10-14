CREATE TABLE onetimetoken (
    "id" serial not null,
    "user_id" integer not null,
    "token" varchar,
    "expired" timestamp with time zone,
    "type" varchar
);

ALTER TABLE onetimetoken ADD CONSTRAINT onetimetoken_pkey PRIMARY KEY (id);
CREATE INDEX ON onetimetoken USING btree (user_id, token);
