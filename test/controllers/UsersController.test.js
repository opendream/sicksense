var pg = require('pg');
var request = require('supertest');
var when = require('when');

describe('UserController test', function() {

  describe('[POST] /users', function() {

    before(function(done) {
      TestHelper.clearUsers()
        .then(TestHelper.clearAccessTokens)
        .then(function() {
          done();
        })
        .catch(function(err) {
          done(err);
        });
    });

    after(function(done) {
      TestHelper.clearUsers()
        .then(TestHelper.clearAccessTokens)
        .then(function() {
          done();
        })
        .catch(function(err) {
          done(err);
        });
    });

    it('should validate parameters', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.status.should.equal(400);
          res.body.meta.errorType.should.equal("Bad Request");
          res.body.meta.errorMessage.should.match(/is required/);

          res.body.meta.invalidFields.should.have.properties([
            'email', 'password', 'tel', 'gender', 'birthYear',
            'address.subdistrict', 'address.district', 'address.city',
            'location.latitude', 'location.longitude'
          ]);

          done();
        });
    });

    it('should save new record', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .send({
          email: "siriwat@opendream.co.th",
          password: "12345678",
          tel: "0841291342",
          gender: "male",
          birthYear: 1986,
          address: {
            subdistrict: "Samsen-Nok",
            district: "Huay Kwang",
            city: "Bangkok"
          },
          location: {
            latitude: 13.1135,
            longitude: 105.0014
          }
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.status.should.equal(200);
          res.body.response.should.not.have.property('password');
          res.body.response.id.should.ok;
          res.body.response.email.should.equal("siriwat@opendream.co.th");
          res.body.response.tel.should.equal("0841291342");
          res.body.response.gender.should.equal("male");
          res.body.response.birthYear.should.equal(1986);
          res.body.response.address.subdistrict.should.equal("Samsen-Nok");
          res.body.response.address.district.should.equal("Huay Kwang");
          res.body.response.address.city.should.equal("Bangkok");
          res.body.response.location.latitude.should.equal(13.1135);
          res.body.response.location.longitude.should.equal(105.0014);
          res.body.response.accessToken.should.be.ok;

          // Also verify that password is encrypted.
          pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
            client.query(
              "SELECT password FROM users WHERE id=$1",
              [ res.body.response.id ],
              function(err, result) {
                pgDone();
                if (err) return done(err);

                result.rows[0].password.should.not.equal("12345678");

                // AccessToken must not expired.
                AccessToken.findOneByToken(res.body.response.accessToken).exec(function(err, accessToken) {
                  if (err) return done(err);
                  accessToken.expired.should.be.ok;
                  accessToken.expired.getTime().should.greaterThan((new Date()).getTime());

                  done();
                });
              }
            );
          });
        });
    });

    it('should not allow to create with existing email', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .send({
          email: "siriwat@opendream.co.th",
          password: "12345678",
          tel: "0841291342",
          gender: "male",
          birthYear: 1986,
          address: {
            subdistrict: "Samsen-Nok",
            district: "Huay Kwang",
            city: "Bangkok"
          },
          location: {
            latitude: 13.1135,
            longitude: 105.0014
          }
        })
        .expect('Content-Type', /json/)
        .expect(409)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.status.should.equal(409);
          res.body.meta.errorType.should.equal('Conflict');
          res.body.meta.errorMessage.should.match(/is already (registered|existed)/);

          done();
        });
    });

  });

});
