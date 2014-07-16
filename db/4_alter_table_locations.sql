ALTER TABLE locations ADD zipcode varchar(5);
ALTER TABLE locations DROP COLUMN "createdAt";
ALTER TABLE locations DROP COLUMN "updatedAt";