/**
 * ReportsController
 *
 * @description :: Server-side logic for managing reports
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {
	create: function(req, res) {
    req.checkBody('isFine', 'Field `isFine` is required').notEmpty();

    if (!req.body.isFine) {
      req.checkBody('symptoms', 'Field `symptoms` is required').notEmpty();
      req.checkBody('symptoms', 'Field `symptoms` is not valid').isArray();
    }

    req.checkBody('animalContact', 'Field `animalContact` is required').notEmpty();

    req.checkBody('startedAt', 'Field `startedAt` is required').notEmpty();
    req.checkBody('startedAt', 'Field `startedAt` is not valid').isDate();

    req.checkBody('location', 'Field `location` is required').hasValue();
    if (req.body.location) {
      req.checkBody('location.latitude', 'Field `location.latitude` is required').notEmpty();
      req.checkBody('location.latitude', 'Location:Latitude field is not valid').isFloat();
      req.checkBody('location.latitude', 'Location:Latitude field is not valid').isBetween(-90, 90);
      req.checkBody('location.longitude', 'Field `location.longitude` is required').notEmpty();
      req.checkBody('location.longitude', 'Location:Longitude field is not valid').isFloat();
      req.checkBody('location.longitude', 'Location:Longitude field is not valid').isBetween(-180, 180);
    }

    var errors = req.validationErrors();
    var paramErrors = req.validationErrors(true);
    if (errors) {
      return res.badRequest(_.first(errors).msg, paramErrors);
    }

    var values = req.body;
    values.userId = req.user.id;

    var report;
    ReportService.create(req.body)
      .then(function(_report) {
        report = _report;
        return ReportService.loadSymptoms(_report);
      })
      .then(function(symptoms) {
        return res.ok(ReportService.getReportJSON(report, { symptoms: symptoms }));
      })
      .catch(function(err) {
        res.serverError(err);
      });
  }
};
