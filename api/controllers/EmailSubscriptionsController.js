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
    },

    send: function(req, res) {
        var settings = sails.config.mailgun;
        var mailgun = MailService.getInstance();
        var email = settings.mailingList + '@' + settings.domain;
        var template = MailService.getTemplate();
        var params = {
            from: settings.from,
            to: email,
            subject: settings.subjects[Math.floor(Math.random() * settings.subjects.length)],
            text: template.text,
            html: template.html
        };

        sails.log.info('Send email notification at ' + new Date());
        mailgun.messages().send(params, function(err, resp) {
            if (err) return sails.log.warn(err);
            sails.log.info(resp.message);
            return res.ok({
                message: resp.message
            });
        });
    }

};
