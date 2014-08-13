var when = require('when');

module.exports = {

    isSubscribed: function(client, user) {
        return when.promise(function(resolve, reject) {
            var statement = 'SELECT * FROM email_subscription WHERE "userId" = $1';
            client.query(statement, [ user.id ], function(err, result) {
                if (err) return reject(err);
                resolve(result.rows.length > 0);
            });
        });
    },

    subscribe: function(client, user) {
        return EmailSubscriptionsService.isSubscribed(client, user)
            .then(function(isSubscribed) {
                if (!isSubscribed) {
                    return DBService.insert('email_subscription', [
                        {
                            field: '"userId"',
                            value: user.id
                        },
                        {
                            field: '"notifyTime"',
                            value: '8:00:00'
                        },
                        {
                            field: '"createdAt"',
                            value: new Date()
                        },
                        {
                            field: '"updatedAt"',
                            value: new Date()
                        }
                    ]);
                }
            });
    },

    unsubscribe: function(client, user) {
        return DBService.delete('email_subscription', [{
            field: '"userId"=$',
            value: user.id
        }])
        .then(function() {
            MailService.subscribe(user.email, 'no');
        });
    },

    getEmailsToNotify: function() {
        return pgconnect()
            .then(function (conn) {
                return when.promise(function(resolve, reject) {
                    var query = "\
                        SELECT users.email \
                        FROM email_subscription \
                        LEFT JOIN users \
                        ON users.id = email_subscription.\"userId\" \
                        WHERE \"notifyTime\" >= CURRENT_TIME - interval '2 minute' AND \
                        \"notifyTime\" <= CURRENT_TIME + interval '2 minute'";

                    conn.client.query(query, function (err, result) {
                        if (err) return reject(err);
                        conn.done();
                        resolve(result.rows);
                    });
                });
            });
    }

};
