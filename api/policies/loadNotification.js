module.exports = function (req, res, next) {
  pgconnect(function (err, client, pgDone) {

    if (err) {
      sails.log.error(err);
      return res.serverError("Server error", err);
    }

    client.query("SELECT * FROM notifications WHERE id = $1", [ req.params.notification_id ],
    function (err, result) {
      pgDone();

      if (err) {
        sails.log.error(err);
        return res.serverError('Server error', err);
      }

      if (result.rows[0].id) {
        req.notification = result.rows[0];
      }
      else {
        res.notFound("Notification not found");
      }

      next();
    });
  });
};
