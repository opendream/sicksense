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

  emailnoti: function (req, res) {
    // select all notification that has not been sent and not deleted.
    pgconnect()
      .then(function (conn) {
        EmailSubscriptionsService.send();
      });
  }

};
