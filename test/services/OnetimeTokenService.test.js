describe('OnetimeToken service test', function () {

  var data = {};

  before(function (done) {

    // create new user
    DBService
    .insert('users', [
      { field: 'email', value: 'onetimetokenuser001@sicksense.org' },
      { field: 'password', value: 'text-here-is-ignored' }
    ])
    .then(function (result) {
      data.user = result.rows[0];
      done();
    })
    .catch(done);

  });

  after(function (done) {

    DBService.delete('users', [
      { field: 'id = $', value: data.user.id }
    ]).then(function () {
      done();
    });

  });


  describe('create()', function () {

    it('should not allowed inexisting user', function (done) {

      OnetimeTokenService.create('test', 12345678, 30)
        .then(
          function success(tokenObject) {
            tokenObject.should.be.empty;
          },
          function error(err) { done(); }
        )
        .catch(done);

    });


    it('should create new token', function (done) {

      OnetimeTokenService.create('test', data.user.id, 30)
        .then(function (tokenObject) {
          tokenObject.should.be.ok;
          tokenObject.user_id.should.equal(data.user.id)
          tokenObject.token.length.should.greaterThan(0);
          tokenObject.expired.should.greaterThan(new Date());
          done();
        })
        .catch(done);

    });

  });

  describe('getByEmail()', function() {

    it('should return existing token', function(done) {

      OnetimeTokenService.getByEmail(data.user.email, 'test')
        .then(function(tokenObject) {
          tokenObject.user_id.should.equal(data.user.id);
          done();
        })
        .catch(done);

    });

  });

});
