truncate reports;
truncate users;
truncate reportssymptoms ;
truncate reports_summary_by_week ;
truncate symptoms_summary_by_week ;

-- PHASE 1 --

insert into reports
("userId", "location_id", "year", "week", "isFine", "isILI") values
(1, 1, 2014, 1, 't', 'f');
-- year 2014, week 1, fine 1, sick 0, ili_count 0

insert into reports
("userId", "location_id", "year", "week", "isFine", "isILI") values
(1, 1, 2014, 1, 'f', 'f');
-- year 2014, week 1, fine 0, sick 1, ili_count 0

-- PHASE 2 --

insert into reports
("userId", "location_id", "year", "week", "isFine", "isILI") values
(1, 1, 2014, 2, 't', 'f');
-- year 2014, week 2, fine 1, sick 0, ili_count 0

insert into reports
("userId", "location_id", "year", "week", "isFine", "isILI") values
(1, 1, 2014, 2, 't', 'f');
-- year 2014, week 2, fine 1, sick 0, ili_count 0

insert into reports
("userId", "location_id", "year", "week", "isFine", "isILI") values
(2, 1, 2014, 2, 't', 'f');
-- year 2014, week 2, fine 2, sick 0, ili_count 0

insert into reports
("userId", "location_id", "year", "week", "isFine", "isILI") values
(1, 1, 2014, 2, 'f', 'f');
-- year 2014, week 2, fine 1, sick 1, ili_count 0

-- PHASE 3 --

insert into reports
("userId", "location_id", "year", "week", "isFine", "isILI") values
(1, 1, 2014, 3, 'f', 'f');
-- year 2014, week 3, fine 0, sick 1, ili_count 0

insert into reports
("userId", "location_id", "year", "week", "isFine", "isILI") values
(1, 1, 2014, 3, 't', 'f');
-- year 2014, week 3, fine 0, sick 1, ili_count 0

insert into reports
("userId", "location_id", "year", "week", "isFine", "isILI") values
(1, 1, 2014, 3, 'f', 't');
-- year 2014, week 3, fine 0, sick 1, ili_count 1

insert into reports
("userId", "location_id", "year", "week", "isFine", "isILI") values
(2, 1, 2014, 3, 'f', 'f');
-- year 2014, week 3, fine 0, sick 2, ili_count 1

insert into reports
("userId", "location_id", "year", "week", "isFine", "isILI") values
(2, 1, 2014, 3, 'f', 't');
-- year 2014, week 3, fine 0, sick 2, ili_count 2

-- PHASE 4 --

insert into reports
("userId", "location_id", "year", "week", "isFine", "isILI") values
(1, 1, 2014, 4, 't', 'f');
-- loc 1, year 2014, week 4, fine 1, sick 0, ili_count 0

insert into reports
("userId", "location_id", "year", "week", "isFine", "isILI") values
(1, 2, 2014, 4, 't', 'f');
-- loc 2, year 2014, week 4, fine 1, sick 0, ili_count 0

insert into reports
("userId", "location_id", "year", "week", "isFine", "isILI") values
(1, 1, 2014, 4, 'f', 'f');
-- loc 1, year 2014, week 4, fine 0, sick 1, ili_count 0
-- loc 2, year 2014, week 4, fine 1, sick 0, ili_count 0

insert into reports
("userId", "location_id", "year", "week", "isFine", "isILI") values
(2, 1, 2014, 4, 't', 'f');
-- loc 1, year 2014, week 4, fine 1, sick 1, ili_count 0
-- loc 2, year 2014, week 4, fine 1, sick 0, ili_count 0

