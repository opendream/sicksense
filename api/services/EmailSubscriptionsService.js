var when = require('when');

module.exports = {

    isSubscribed: function(sicksenseID) {
        return when.promise(function (resolve, reject) {
            return DBService.select('email_subscription', '*', [
                    { field: '"userId" = $', value: parseInt(sicksenseID.id) }
                ])
                .then(function (result) {
                    resolve(result.rows.length > 0);
                })
                .catch(function (err) {
                    reject(err);
                });
        });
    },

    subscribe: function(sicksenseID) {
        return EmailSubscriptionsService.isSubscribed(sicksenseID)
            .then(function(isSubscribed) {
                if (!isSubscribed) {
                    return DBService.insert('email_subscription', [
                        {
                            field: '"userId"',
                            value: sicksenseID.id
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

    unsubscribe: function(sicksenseID) {
        return DBService.delete('email_subscription', [{
            field: '"userId"=$',
            value: sicksenseID.id
        }])
        .then(function() {
            MailService.subscribe(sicksenseID.email, 'no');
        });
    },

    getEmailsToNotify: function() {
        var now = (new Date()).getTime();
        return pgconnect()
            .then(function (conn) {
                sails.log.debug('[EmailSubscrioptionsService:getEmailsToNotify]', now);
                return when.promise(function(resolve, reject) {
                    var query = "\
                        SELECT users.email \
                        FROM email_subscription \
                        LEFT JOIN users \
                        ON users.id = email_subscription.\"userId\" \
                        WHERE \"notifyTime\" >= CURRENT_TIME - interval '2 minute' AND \
                        \"notifyTime\" <= CURRENT_TIME + interval '2 minute'";

                    conn.client.query(query, function (err, result) {
                        conn.done();
                        sails.log.debug('[EmailSubscrioptionsService:getEmailsToNotify]', now);
                        if (err) return reject(err);
                        resolve(result.rows);
                    });
                });
            });
    }

};
