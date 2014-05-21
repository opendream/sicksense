-- Table: users

DROP TABLE users;

CREATE TABLE users
(
  id serial NOT NULL,
  email text NOT NULL,
  password text NOT NULL,
  tel text,
  gender text,
  "birthYear" integer,
  subdistrict text,
  district text,
  city text,
  latitude double precision,
  longitude double precision,
  geom Geometry(Point, 4326),
  "createdAt" timestamp with time zone,
  "updatedAt" timestamp with time zone,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_key UNIQUE (email)
)
WITH (
  OIDS=FALSE
);
