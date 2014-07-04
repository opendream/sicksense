#!/usr/bin/env python
import datetime
import os
import psycopg2
import psycopg2.extras
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

        # ILI percentage.
        self.min_ili_percentage = 5
        self.max_ili_percentage = 15

        # Number of reports.
        self.min_reports_per_province = 1

        # Number of users.
        self.num_users = 1000

        # Start date.
        self.start_date = (2013, 1, 1)


    def start(self):
        try:
            self.clean_up_database()
            self.create_users()
            self.generate_reports();

        except psycopg2.DatabaseError, e:
            if self.conn:
                self.conn.rollback()
            print 'DatabaseError: %s' % e

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

    def get_locations(self):
        self.cursor.execute("SELECT * FROM locations ORDER BY id ASC")
        records = self.cursor.fetchall()
        locations = {}
        for record in records:
            province_name = record["province_en"]
            if not locations.has_key(province_name):
                locations[province_name] = []
            locations[province_name].append(record)
        return locations

    def clean_up_database(self):
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
        print 'Importing data'
        print '====================================================='
        ret = subprocess.call(['psql', 'sicksense < %s' % sql_path], shell=True)
        print '====================================================='
        print 'Finish import data from %s' % sql_path
        print '====================================================='
        if ret == 1:
            exit()

        # Start connect new database.
        self.connect(self.dbname)

    def create_users(self):
        columns = ('email', 'password', 'tel', 'gender', 'birthYear', 'subdistrict', 'district',
            'city', 'latitude', 'longitude', 'createdAt', 'updatedAt')
        locations = self.get_locations()
        # for location in locations:
        #     print location

    def generate_reports(self):
        start_date = datetime.date(self.start_date[0], self.start_date[1], self.start_date[2])
        end_date = datetime.date.today()
        days = (end_date - start_date).days
        current_date = start_date

        for i in range(days + 1):
            date = start_date + datetime.timedelta(days=i)
            self._generate_reports(date)

    def _generate_reports(self, date):
        # print date
        pass

if __name__ == "__main__":
    mock = MockData()
    mock.start()
