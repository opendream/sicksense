
describe("UtilityService test", function () {

  describe("refinePercent", function () {

    it('should return refined percent values', function (done) {
      var sample = [
        { name: 'x', numberOfReports: 3366, percentOfReports: 33.67 },
        { name: 'y', numberOfReports: 3366, percentOfReports: 33.67 },
        { name: 'z', numberOfReports: 3266, percentOfReports: 32.67 }
      ];

      UtilityService.refinePercent(sample, 'percentOfReports');

      sample[0].percentOfReports.should.equal(33.67);
      sample[1].percentOfReports.should.equal(33.67);
      sample[2].percentOfReports.should.equal(32.66);

      done();
    });

    it('should adjust values', function (done) {
      var sample = [
        { value: 16.67 },
        { value: 16.67 },
        { value: 16.67 },
        { value: 16.67 },
        { value: 16.67 },
        { value: 16.67 }
      ];

      UtilityService.refinePercent(sample, 'value');

      sample[0].value.should.equal(16.67);
      sample[1].value.should.equal(16.67);
      sample[2].value.should.equal(16.67);
      sample[3].value.should.equal(16.67);
      sample[4].value.should.equal(16.67);
      sample[5].value.should.equal(16.65);

      done();
    });

    it('should respect adjust threshold', function (done) {
      var sample = [
        { value: 9.09 },
        { value: 9.09 },
        { value: 9.09 },
        { value: 9.09 },
        { value: 9.09 },
        { value: 9.09 },
        { value: 9.09 },
        { value: 9.09 },
        { value: 9.09 },
        { value: 9.09 },
        { value: 9.09 }
      ];

      UtilityService.refinePercent(sample, 'value', 0.02);

      sample[0].value.should.equal(9.09);
      sample[1].value.should.equal(9.09);
      sample[2].value.should.equal(9.09);
      sample[3].value.should.equal(9.09);
      sample[4].value.should.equal(9.09);
      sample[5].value.should.equal(9.09);
      sample[6].value.should.equal(9.09);
      sample[7].value.should.equal(9.09);
      sample[8].value.should.equal(9.09);
      sample[9].value.should.equal(9.09);
      sample[10].value.should.equal(9.09);

      done();
    });

  });

});
