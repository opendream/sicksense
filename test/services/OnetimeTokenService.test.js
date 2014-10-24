var when = require('when');

describe('OnetimeToken service test', function () {

  var data = {};

  before(function (done) {

    // create new user
    DBService
    .insert('sicksense', [
      { field: 'email', value: 'onetimetokenuser001@sicksense.com' },
      { field: 'password', value: 'text-here-is-ignored' },
      { field: '"createdAt"', value: new Date() },
      { field: '"updatedAt"', value: new Date() }
    ])
    .then(function (result) {
      data.user = result.rows[0];
      done();
    })
    .catch(done);

  });

  after(function (done) {

    DBService.delete('sicksense', [
      { field: 'id = $', value: data.user.id }
    ]).then(function () {
      done();
    });

  });


  describe('create()', function () {

    it('should not allowed inexisting user', function (done) {

      OnetimeTokenService.create('test', 12345678, sails.config.onetimeToken.lifetime)
        .then(
          function success(tokenObject) {
            tokenObject.should.be.empty;
          },
          function error(err) { done(); }
        )
        .catch(done);

    });


    it('should create new token', function (done) {

      var now = new Date();

      OnetimeTokenService.create('test', data.user.id, sails.config.onetimeToken.lifetime)
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

  describe('getByToken()', function() {

    it('should return existing token', function(done) {
      var onetimeToken;

      OnetimeTokenService.create('test', data.user.id, sails.config.onetimeToken.lifetime)
        .then(function(token) {
          onetimeToken = token;
          return OnetimeTokenService.getByToken(token.token);
        })
        .then(function(tokenObject) {
          tokenObject.should.be.ok;
          tokenObject.token.should.equal(onetimeToken.token);
          done();
        })
        .catch(done);

    });

    it('should return empty token if invalid token is provided', function(done) {

      OnetimeTokenService.getByToken('invalid token')
        .then(function(onetimeToken) {
          (onetimeToken === undefined).should.be.true;
          done();
        })
        .catch(done);

    });

  });

  describe('isValidTokenString()', function () {
    var data = {};

    before(function (done) {

      // create new user
      DBService
      .insert('sicksense', [
        { field: 'email', value: 'verifyemailtest300@opendream.co.th' },
        { field: 'password', value: 'text-here-is-ignored' },
      { field: '"createdAt"', value: new Date() },
      { field: '"updatedAt"', value: new Date() }
      ])
      .then(function (result) {
        data.user = result.rows[0];
        // assign verification token
        return OnetimeTokenService.create('test', data.user.id, 10)
          .then(function (tokenObject) {
            data.tokenObject = tokenObject;
          });
      })
      .then(done)
      .catch(done);

    });

    it('should return token object if valid', function (done) {

      OnetimeTokenService.isValidTokenString(data.tokenObject.token)
        .then(function (result) {
          result.id.should.equal(data.tokenObject.id);
          result.user_id.should.equal(data.tokenObject.user_id);
          result.token.should.equal(data.tokenObject.token);
          done();
        });

    });

    it('should return false if not valid', function (done) {

      DBService.update('onetimetoken', [
        { field: 'expired = $', value: new Date() }
      ], [
        { field: 'id = $', value: data.tokenObject.id }
      ]).then(function () {

        OnetimeTokenService.isValidTokenString(data.tokenObject.token)
          .then(function (result) {
            result.should.equal(false);
            done();
          })
          .catch(done);

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
      DBService.insert('sicksense', [
          { field: 'email', value: 'onetimetokenuser002@sicksense.com' },
          { field: 'password', value: 'text-here-is-ignored' },
          { field: '"createdAt"', value: new Date() },
          { field: '"updatedAt"', value: new Date() }
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
