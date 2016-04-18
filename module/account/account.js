var bcrypt = require('bcrypt');
var knex = require('knex');

var winston = require('winston');

var common = require('../../lib/common');
var connection = require('../../lib/connection');

var salt = bcrypt.genSaltSync(10);

function authByID(id, callback) {
    var db = connection.get();

    // db.where({id: id}).select('id','nickname','email','level','grant').from('auth').then(function (error, results) {
    db.where({id: id}).select('id','user_id').from('auth').then(function (error, results) {
        console.log(error, results);

        callback(error, results[0]);
    });

    /*
    var idx = id - 1;
    if (users[idx]) {
        callback(null, users[idx]);
    } else {
        callback(new Error('User ' + id + ' does not exist'));
    }*/
}

function authByUserID(userID, fn) {
    for (var i = 0, len = users.length; i < len; i++) {
        var user = users[i];
        if (user.username === userID) {
            return fn(null, user);
        }
    }
    return fn(null, null);
}

/* Fake, in-memory database of remember me tokens */

var tokens = {};

function consumeRememberMeToken(token, fn) {
    var uid = tokens[token];
    // invalidate the single-use token
    delete tokens[token];
    return fn(null, uid);
}

function saveRememberMeToken(token, uid, fn) {
    tokens[token] = uid;
    return fn();
}

function authenticate(username, password, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {

        // Find the user by username.  If there is no user with the given
        // username, or the password is not correct, set the user to `false` to
        // indicate failure and set a flash message.  Otherwise, return the
        // authenticated `user`.
        authByUserID(username, function (err, user) {
            if (err) {
                return done(err);
            }
            if (!user) {
                return done(null, false, {message: 'Unknown user ' + username});
            }
            if (user.password != password) {
                return done(null, false, {message: 'Invalid password'});
            }
            return done(null, user);
        })
    });
}

function issueToken(user, done) {
    var token = common.randomString(64);
    saveRememberMeToken(token, user.id, function(err) {
        if (err) { return done(err); }
        return done(null, token);
    });
}

function serialize(user, done) {
    done(null, user.id);
}

function deserialize(id, done) {
    authByID(id, function (err, user) {
        done(err, user);
    });
}


function loginSuccess(req, res, next) {
    winston.verbose('Log in ---- process ---- done');
    // Issue a remember me cookie if the option was checked
    if (!req.body.remember_me) { return next(); }

    issueToken(req.user, function(err, token) {
        winston.info('Issue Cookie Token', token);

        if (err) { return next(err); }
        res.cookie('remember_me', token, { path: '/', httpOnly: true, maxAge: 604800000 });
        return next();
    });
}

function loginDone(req, res) {
    res.redirect('/');
}

function register(req, res) {
    req.assert('nickname', 'screen name is required').len(2, 20).withMessage('Must be between 2 and 10 chars long').notEmpty();
    req.assert('email', 'Email as User ID field is not valid').notEmpty().withMessage('User ID is required').isEmail();
    req.assert('password', 'Password must be at least 4 characters long').len(4);
    req.assert('password_check', 'Password Check must be same as password characters').notEmpty().withMessage('Password Check field is required').equals(req.body.password);

    req.sanitize('nickname').escape();

    var errors = req.validationErrors();

    if (errors) {
        req.flash('error', errors);
        return res.redirect('back');
    }

    var hash = bcrypt.hashSync(req.body.password, salt);

    var authData = {
        user_id: req.body.email,
        user_password: hash
    };

    var db = connection.get();

    // save to auth table
    db.insert(authData, 'id').into('auth').then(function (authResults) {
        var auth_id = Array.isArray(authResults) ? authResults.pop() : authResults;
        winston.info('inserted', auth_id, 'auth id user');

        // save to user table
        var userData = {
            uuid: common.UUID(),
            auth_id: auth_id,
            nickname: req.body.nickname,
            level: 1,
            grant: '',
            login_counter: 1,
            last_logged_at: new Date(),
            created_at: new Date()
        };

        req.flash('info', 'Saved Account by ' + userData.nickname, '(' + authData.user_id + ')');

        db.insert(userData, 'id').into('user').then(function (userResults) {

            var user = {
                uuid: userData.uuid,
                user_id: authData.user_id,
                nickname: userData.nickname,
                level: userData.level,
                grant: userData.grant
            };

            req.logIn(user, function (err) {
                if (err) {
                    req.flash('error', {msg: '로그인 과정에 문제가 발생했습니다.'});

                    winston.error(error);

                    return res.redirect('back');
                }

                res.redirect('/');
            });
        }).catch(function (error) {
            req.flash('error', {msg: '사용자 정보 저장에 실패했습니다.'});

            winston.error(error);

            res.redirect('back');
        });

    }).catch(function (error) {
        req.flash('error', {msg: '계정 정보 저장에 실패했습니다.'});

        winston.error(error);

        res.redirect('back');
    });








}

module.exports = {
    serialize: serialize,
    deserialize: deserialize,
    authenticate: authenticate,
    loginSuccess: loginSuccess,
    loginDone: loginDone,
    register: register
};