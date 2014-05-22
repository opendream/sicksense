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

DROP TABLE reports;

CREATE TABLE reports
(
  id serial NOT NULL,
  "isFine" boolean,
  "animalContact" boolean,
  "startedAt" timestamp with time zone,
  latitude double precision,
  longitude double precision,
  geom Geometry(Point, 4326),
  "moreInfo" text,
  "userId" integer,
  "createdAt" timestamp with time zone,
  "updatedAt" timestamp with time zone,
  CONSTRAINT reports_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);

DROP TABLE symptoms;

CREATE TABLE symptoms
(
  id serial NOT NULL,
  name text,
  "createdAt" timestamp with time zone,
  "updatedAt" timestamp with time zone,
  CONSTRAINT symptoms_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);

DROP TABLE reportssymptoms;

CREATE TABLE reportssymptoms
(
  "reportId" integer,
  "symptomId" integer,
  id serial NOT NULL,
  "createdAt" timestamp with time zone,
  "updatedAt" timestamp with time zone,
  CONSTRAINT reportssymptoms_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);
