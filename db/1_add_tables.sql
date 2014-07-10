CREATE EXTENSION postgis;

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
  subdistrict text,
  district text,
  city text,
  "addressLatitude" double precision,
  "addressLongitude" double precision,
  latitude double precision,
  longitude double precision,
  geom Geometry(Point, 4326),
  "moreInfo" text,
  "userId" integer NOT NULL,
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
  name text NOT NULL,
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
  id serial NOT NULL,
  "reportId" integer NOT NULL,
  "symptomId" integer NOT NULL,
  "createdAt" timestamp with time zone,
  "updatedAt" timestamp with time zone,
  CONSTRAINT reportssymptoms_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);

DROP TABLE locations;

CREATE TABLE locations
(
  code text,
  tambon_th text,
  tambon_en text,
  amphoe_en text,
  amphoe_th text,
  province_en text,
  province_th text,
  latitude double precision,
  longitude double precision,
  id serial NOT NULL,
  "createdAt" timestamp with time zone,
  "updatedAt" timestamp with time zone,
  geom geometry(Point,4326),
  CONSTRAINT locations_pkey PRIMARY KEY (id),
  CONSTRAINT locations_code_key UNIQUE (code)
)
WITH (
  OIDS=FALSE
);

DROP TABLE reportssymptoms;
CREATE TABLE reportssymptoms
(
  "reportId" integer,
  "symptomId" integer
);
CREATE UNIQUE INDEX ON reportssymptoms ( "reportId", "symptomId" );
