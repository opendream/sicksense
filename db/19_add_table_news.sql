CREATE TABLE news (
    "id" serial not null,
    "title" varchar(100) not null,
    "content" text not null,
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone
);

ALTER TABLE news ADD CONSTRAINT news_pkey PRIMARY KEY (id);
