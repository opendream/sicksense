var Mailgun = require('mailgun-js');
var settings = sails.config.mailgun;

module.exports = {

    getInstance: function() {
        var mailgun = new Mailgun({
            apiKey: settings.apiKey,
            domain: settings.domain
        });

        return mailgun;
    },

    subscribe: function(email, subscribed) {
        var mailgun = MailService.getInstance();
        var list = mailgun.lists(settings.mailingList + '@' + settings.domain);

        list.members().create({
            subscribed: true,
            address: email
        }, function(err, resp) {
            if (err) {
                sails.log.warn(err);
                list.members(email).update({ subscribed: subscribed }, function(err, resp) {
                    if (err) {
                        sails.log.warn(err);
                    }
                    else {
                        sails.log.info(resp.message);
                    }
                });
            }
            else {
                sails.log.info(resp.message);
            }
        });
    },

    getTemplate: function() {
        return {
            text: 'Title test %mailing_list_unsubscribe_url%',
            html: '<h2>Title</h2><br />test %mailing_list_unsubscribe_url%'
        };
    }

};
