CREATE TABLE sicksense (
    "id" serial not null,
    "email" varchar not null,
    "is_verify" boolean default 'f',
    "data" json,
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone
);

ALTER TABLE sicksense ADD CONSTRAINT sicksense_pkey PRIMARY KEY (id);
CREATE INDEX ON sicksense USING btree (email, is_verify);

CREATE TABLE sicksense_users (
    "sicksense_id" integer not null,
    "user_id" integer not null
);

ALTER TABLE sicksense_users ADD CONSTRAINT sicksense_unique_keys UNIQUE (sicksense_id, user_id);
