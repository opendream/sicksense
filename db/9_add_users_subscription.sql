CREATE TABLE devices (
  id varchar,
  platform varchar default 'ios',
  user_id varchar,
  subscribe_pushnoti boolean default 't',
  subscribe_pushnoti_type smallint default 0,
  "createdAt" timestamp with time zone,
  "updatedAt" timestamp with time zone
);

ALTER TABLE devices ADD CONSTRAINT devices_pkey PRIMARY KEY (id);
CREATE INDEX ON devices USING btree (platform, user_id, subscribe_pushnoti);

ALTER TABLE accesstoken ADD "deviceId" varchar;
