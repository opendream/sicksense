#!/usr/bin/env python
import datetime
import math
import os
import psycopg2
import psycopg2.extras
import random
import string
import sys
import subprocess

class MockData:

    def __init__(self):
        # Database.
        self.host = 'localhost'
        self.dbname = 'sicksense'
        self.username = 'rutcreate'
        self.password = ''
        self.conn_string = "host='%s' dbname='%s' user='%s' password='%s'" % (
            self.host, self.dbname, self.username, self.password)
        self.conn = None
        self.cursor = None
        self.tableUsers = 'users'
        self.tableReports = 'reports'
        self.tableReportsSymptoms = 'reportssymptoms'

        # ILI percentage.
        self.min_ili_percentage = 0.05
        self.max_ili_percentage = 0.15

        # Number of reports.
        self.min_reports_per_province = 1

        # Number of users.
        self.min_num_users_in_province = 100
        self.max_num_users_in_province = 150

        # Start date.
        self.start_date = (2013, 1, 1)
        self.end_date = (2014, 12, 12)

    def start(self):
        try:
            self.clean_up_database()
            self.create_users()
            self.generate_reports();

        except psycopg2.DatabaseError, e:
            if self.conn:
                self.conn.rollback()
            print 'DatabaseError: %s' % e

    def clean_up_database(self):
        print '====================================================='
        print 'Clean up database'
        print '====================================================='
        # Drop database and create new one.
        self.connect('postgres')
        self.conn.set_isolation_level(0)
        self.cursor.execute("DROP DATABASE IF EXISTS %s" % self.dbname)
        print 'DROP DATABASE %s' % self.dbname
        self.cursor.execute("CREATE DATABASE %s" % self.dbname)
        print 'CREATE DATABASE %s' % self.dbname
        self.conn.close()

        # Import data.
        sql_path = '%s/base.sql' % os.path.dirname(os.path.realpath(__file__))
        print 'Importing data from %s' % sql_path
        ret = subprocess.call(['psql sicksense < %s' % sql_path], shell=True)
        print 'Finish'
        if ret == 1:
            exit()

        # Start connect new database.
        self.connect(self.dbname)

        # Prepare data.
        self.fetch_locations()
        self.fetch_symptoms()

    def create_users(self):
        print '====================================================='
        print 'Create users'
        print '====================================================='
        for location in self.locations:
            num_users = random.randint(self.min_num_users_in_province, self.max_num_users_in_province)
            districts = self.locations[location]['districts']
            print 'Add %d users in province %s' % (num_users, location)
            for i in range(num_users):
                self.create_user(random.choice(districts))
            self.conn.commit()

            # Store users into each province.
            self.cursor.execute("SELECT * FROM users WHERE city = '%s'" % location)
            users = self.cursor.fetchall()
            self.locations[location]['users'] = []
            for user in users:
                self.locations[location]['users'].append(user)

    def create_user(self, data):
        columns = ('email', 'password', 'tel', 'gender', '"birthYear"', 'subdistrict', 'district',
            'city', 'latitude', 'longitude', '"createdAt"', '"updatedAt"')
        values = []
        values.append(self.get_random_email())
        values.append(self.get_random_string())
        values.append(self.get_random_tel())
        values.append(self.get_random_gender())
        values.append(self.get_random_birthYear())
        values.append(data['tambon_en'])
        values.append(data['amphoe_en'])
        values.append(data['province_en'])
        values.append(str(data['latitude']))
        values.append(str(data['longitude']))
        values.append(self.get_random_date())
        values.append(self.get_random_date())

        strSql = self.get_insert_statement(self.tableUsers, columns, values)
        self.cursor.execute(strSql)

    def generate_reports(self):
        start_date = datetime.date(self.start_date[0], self.start_date[1], self.start_date[2])
        # Shift date the start date to a day of weeks.
        if start_date.weekday() > 0:
            start_date = start_date - datetime.timedelta(days=start_date.weekday() + 1)
        end_date = datetime.date(self.end_date[0], self.end_date[1], self.end_date[2])
        days = (end_date - start_date).days + 1

        # How many weeks from date range.
        num_weeks = int(math.ceil(days / 7))

        print '====================================================='
        print 'Start generate from %s (%d weeks)' % (start_date, num_weeks)
        print '====================================================='
        for i in range(num_weeks):
            date = start_date + datetime.timedelta(days=i * 7)
            self.generate_week_reports(date)
            print 'Week %d : %s - %s' % (num_weeks - i, date, date + datetime.timedelta(days=7))
        self.conn.commit()

    def generate_week_reports(self, start_date):
        # Report every province.
        for province in self.locations:
            # User in province.
            users = self.locations[province]['users']
            random.shuffle(users)
            num_users = len(users)
            num_users_per_week = int(math.ceil(num_users / 7.0))

            # All subdistrict in province.
            districts = self.locations[province]['districts']

            # ILI rate.
            ili_rate = random.uniform(self.min_ili_percentage, self.max_ili_percentage)
            num_users_ili = int(round(num_users * ili_rate))

            # Make reports 7 days.
            for i in range(7):
                # Increase by 1 day.
                current_date = start_date + datetime.timedelta(days=i)

                for j in range(num_users_per_week):
                    idx = i * num_users_per_week + j
                    if idx < num_users:
                        self.generate_report(current_date, users[idx],
                            random.choice(districts), idx < num_users_ili)

    def generate_report(self, date, user, district, isILI):
        reports_columns = ('"isFine"', '"animalContact"', '"startedAt"', 'subdistrict',
            'district', 'city', '"addressLatitude"', '"addressLongitude"', 'latitude', 'longitude',
            '"userId"', '"createdAt"', '"updatedAt"')
        reports_values = []

        if isILI:
            isFine = 'f'
            animalContact = 'f' if random.getrandbits(1) else 't'
            symptomId = random.choice(self.symptomsILI)['id']
        elif random.getrandbits(1):
            isFine = 'f'
            animalContact = 'f' if random.getrandbits(1) else 't'
            symptomId = random.choice(self.symptomsNotILI)['id']
        else:
            isFine = 't'
            animalContact = 'f'
            symptomId = random.choice(self.symptomsNotILI)['id']

        reports_values.append(isFine)
        reports_values.append(animalContact)
        reports_values.append(self.format_date(date))
        reports_values.append(district['tambon_en'])
        reports_values.append(district['amphoe_en'])
        reports_values.append(district['province_en'])
        reports_values.append(str(district['latitude']))
        reports_values.append(str(district['longitude']))
        reports_values.append(str(district['latitude']))
        reports_values.append(str(district['longitude']))
        reports_values.append(str(user['id']))
        reports_values.append(self.format_date(date))
        reports_values.append(self.format_date(date))

        strSql = self.get_insert_statement(self.tableReports, reports_columns, reports_values)
        self.cursor.execute(strSql)
        reportId = self.cursor.fetchone()[0]

        # ReportsSymptom.
        rs_columns = ('"reportId"', '"symptomId"', '"createdAt"', '"updatedAt"')
        rs_values = []
        rs_values.append(str(reportId))
        rs_values.append(str(symptomId))
        rs_values.append(self.format_date(date))
        rs_values.append(self.format_date(date))
        strSql = self.get_insert_statement(self.tableReportsSymptoms, rs_columns, rs_values)
        self.cursor.execute(strSql)

    def get_connection_string(self, dbname):
        return "host='%s' dbname='%s' user='%s' password='%s'" % (
            self.host, dbname, self.username, self.password
        )

    def connect(self, dbname):
        try:
            self.conn = psycopg2.connect(self.get_connection_string(dbname))
            self.cursor = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        except psycopg2.DatabaseError, e:
            print 'DatabaseError: %s' % e

    def get_insert_statement(self, tableName, columns, values):
        return "INSERT INTO %s (%s) VALUES ('%s') RETURNING id" % (
            tableName, ','.join(columns), "','".join(values)
        )

    def fetch_locations(self):
        self.cursor.execute("SELECT * FROM locations ORDER BY id ASC")
        records = self.cursor.fetchall()
        self.locations = {}
        for record in records:
            province_name = record["province_en"]
            if not self.locations.has_key(province_name):
                self.locations[province_name] = { 'districts': [] }
            self.locations[province_name]['districts'].append(record)

    def fetch_symptoms(self):
        self.cursor.execute("SELECT * FROM symptoms ORDER BY id ASC")
        records = self.cursor.fetchall()
        self.symptomsILI = []
        self.symptomsNotILI = []
        for record in records:
            if record['id'] > 27:
                sid = 's%d' % record['id']
                if record['id'] in (28, 29, 33):
                    self.symptomsILI.append(record)
                else:
                    self.symptomsNotILI.append(record)

    def get_random_email(self, size=16, address='@example.com'):
        return '%s%s' % (self.get_random_string(size), address)

    def get_random_string(self, size=16):
        return ''.join(random.choice(string.ascii_letters + string.digits) for x in range(size))

    def get_random_tel(self):
        codes = ['090', '081', '082', '083', '084', '085', '086', '087', '088', '089']
        code = random.choice(codes)
        number = self.get_random_digit(7)
        return "%s%s" % (code, number)

    def get_random_digit(self, size=10):
        return ''.join(random.choice(string.digits) for x in range(size))

    def get_random_gender(self):
        genders = ['male', 'female']
        return random.choice(genders)

    def get_random_birthYear(self):
        return str(random.randint(1940, 2000))

    def get_random_date(self):
        return '2014-06-24 18:07:08.787+07'

    def format_date(self, date):
        return date.strftime('%Y-%m-%d 15:10:30.312+07')

if __name__ == "__main__":
    mock = MockData()
    mock.start()
