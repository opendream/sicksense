var Mailgun = require('mailgun-js');
var settings = sails.config.mailgun;

module.exports = {

    getInstance: function() {
        var mailgun = new Mailgun({
            apiKey: settings.apiKey,
            domain: settings.domain
        });
        return mailgun.lists(settings.mailingList + '@' + settings.domain);
    },

    subscribe: function(email, subscribed) {
        var list = MailService.getInstance()
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
    }

};
