ALTER TABLE email_subscription ALTER COLUMN "notifyTime" TYPE time with time zone USING "notifyTime"::time with time zone;
ALTER TABLE email_subscription ALTER COLUMN "userId" TYPE integer USING "userId"::integer;