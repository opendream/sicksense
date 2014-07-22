SET client_encoding = 'UTF8';

DROP TABLE accesstoken;
CREATE TABLE accesstoken (
    token text,
    "userId" text,
    expired timestamp with time zone,
    id serial NOT NULL,
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone
);

ALTER TABLE ONLY accesstoken
    ADD CONSTRAINT accesstoken_pkey PRIMARY KEY (id);
ALTER TABLE ONLY accesstoken
    ADD CONSTRAINT accesstoken_token_key UNIQUE (token);
