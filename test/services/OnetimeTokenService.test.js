var when = require('when');

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

    it('should return empty token', function(done) {

      OnetimeTokenService.getByEmail('no-one@example.com', 'test')
        .catch(function() {
          done();
        });

    });

  });

  describe('delete()', function() {
    var localUser;
    var mockTokens = [
      {
        token: '12345678',
        type: 'testdelete',
        expired: new Date()
      },
      {
        token: '23456789',
        type: 'testdelete',
        expired: new Date()
      }
    ];

    before(function (done) {
      DBService.insert('users', [
          { field: 'email', value: 'onetimetokenuser002@sicksense.org' },
          { field: 'password', value: 'text-here-is-ignored' }
        ])
        .then(function (result) {
          localUser = result.rows[0];
          return when.map(mockTokens, function(token) {
            return DBService.insert('onetimetoken', [
              { field: 'user_id', value: localUser.id },
              { field: 'token', value: token.token },
              { field: 'type', value: token.type },
              { field: 'expired', value: token.expired }
            ]);
          });
        })
        .then(function(results) {
          done();
        })
        .catch(done);
    });

    after(function (done) {
      DBService.delete('onetimetoken', [
          { field: 'type = $', value: 'testdelete' }
        ]).then(function () {
          done();
        });
    });

    it('should remove old tokens', function(done) {

      DBService.select('onetimetoken', '*', [
          { field: 'user_id = $', value: localUser.id },
          { field: 'type = $', value: 'testdelete' }
        ])
        .then(function(result) {
          result.rows.length.should.equal(2);
          return OnetimeTokenService.delete(localUser.id, 'testdelete');
        })
        .then(function() {
          return DBService.select('onetimetoken', '*', [
            { field: 'user_id = $', value: localUser.id },
            { field: 'type = $', value: 'testdelete' }
          ]);
        })
        .then(function(result) {
          result.rows.length.should.equal(0);
          done();
        });

    });

  });

});