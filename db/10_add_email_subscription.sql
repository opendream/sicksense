CREATE TABLE email_subscription (
    token text,
    "userId" text,
    id serial NOT NULL,
    "notifyTime" text,
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone
);

ALTER TABLE ONLY email_subscription
    ADD CONSTRAINT email_subscription_pkey PRIMARY KEY (id);
ALTER TABLE ONLY email_subscription
    ADD CONSTRAINT email_subscription_token_key UNIQUE (token);
