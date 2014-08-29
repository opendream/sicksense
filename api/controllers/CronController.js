var when = require('when');

module.exports = {
  pushnoti: function (req, res) {
    // select all notification that has not been sent and not deleted.
    pgconnect()
      .then(function (conn) {
        var query = "\
          SELECT * \
          FROM notifications \
          WHERE status IN ($1, $2) AND (published IS NULL OR published < NOW()) \
          ORDER BY published";
        var values = [
          NotificationsService.STATUS.pending,
          NotificationsService.STATUS.fail
        ];

        conn.client.query(query, values, function (err, result) {
          conn.done();

          if (err) {
            sails.log.error(err);
            return res.serverError("Server error", err);
          }

          if (result.rows.length === 0) {
            return res.ok({
              message: "Nothing to send, done."
            });
          }

          when
            .map(result.rows, function (item) {
              // TODO: need check
              return NotificationsService.push(item);
            })
            .then(function (notifications) {
              var doneNotifications = _.filter(notifications, { status: NotificationsService.STATUS.sent });
              res.ok({
                message: {
                  all: notifications.length,
                  done: doneNotifications.length
                }
              });
            })
            .catch(function (err) {
              sails.log.error(err);
              res.serverError("Error", err);
            });
        });
      })
      .catch(function (err) {
        sails.log.error(err);
        res.serverError("Server error", err);
      });

  },

  email_notification: function (req, res) {
      EmailSubscriptionsService.getEmailsToNotify()
        .then(function(rows) {
          var maxEmails = 1;
          var emails = _.pluck(rows, 'email');
          var numEmails = emails.length;
          var numRounds = Math.ceil(numEmails / maxEmails);
          var subjects = sails.config.mailgun.subjects;
          var from = sails.config.mailgun.from;
          var template = MailService.getTemplate();

          when.map(_.range(0, numRounds), function(i) {
            var to = emails.splice(0, maxEmails);
            var subject = subjects[Math.floor(Math.random() * subjects.length)];
            return MailService.send(subject, template.text, from, to, template.html);
          })
          .then(function() {
            return res.ok({
              message: 'Messages have been sent.'
            });
          });
        })
        .catch(function(error) {
          return res.serverError("Could not perform request");
        });
  }

};
