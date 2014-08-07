module.exports = {

    hooks: function(req, res) {
        if (!req.body.event) return res.forbidden('Event missing.');
        if (!req.body.recipient) return res.forbidden('Recipient missing.');

        var eventName = req.body.event;
        if (eventName == 'unsubscribed') {
            pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, done) {
                if (err) return res.serverError('Could not connect to database');

                UserService.getUserByEmail(client, req.body.recipient)
                    .then(function(user) {
                        return EmailSubscriptionsService.unsubscribe(client, user);
                    })
                    .then(function() {
                        return res.ok({
                            message: eventName
                        });
                    })
                    .catch(function(err) {
                        if (err.statusCode == 403) {
                            return res.forbidden(err);
                        }
                        else {
                            return res.serverError(err);
                        }
                    })
                    .finally(function() {
                        done();
                    });
            });
        }
        else {
            return res.forbidden('Unknown event: ' + eventName);
        }
    }

};
