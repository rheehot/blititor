const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const moment = require('moment');
const winston = require('winston');
const useragent = require('useragent');

const common = require('../../../core/lib/common');
const misc = require('../../../core/lib/misc');
const connection = require('../../../core/lib/connection');

const counter = require('../../counter');

const db = require('./database');
const query = require('./query');

const token = misc.commonToken();

function findAccountByID(id, callback) {
    const mysql = connection.get();

    db.readAccountByID(mysql, id, function (err, account) {
        if (err || !account) {
            winston.error("Can't Find by This ID", err, account);

            return callback(err, null);
        }

        callback(null, account);
    });
}

function findAccountByUUID(UUID, callback) {
    const mysql = connection.get();

    db.readAccountByUUID(mysql, UUID, function (err, account) {
        if (err || !account) {
            winston.error("Can't Find by This UUID", err, account);

            return callback(err, null);
        }

        callback(err, account);
    });
}

function findAccountByAuthID(authID, callback) {
    const mysql = connection.get();

    db.readAccountByAuthID(mysql, authID, function (err, account) {
        if (err || !account) {
            winston.error("Can't Find by This authID", err, account);

            return callback(err, null);
        }

        callback(err, account);
    });
}

function findAuthByUserID(userID, callback) {
    const mysql = connection.get();

    db.readAuthByUserID(mysql, userID, function (err, auth) {
        if (err || !auth) {
            winston.warn("Can't Find by This userID", err, auth);

            return callback(err, null);
        }

        callback(err, auth);
    });
}

function insertLastLog(uuid, loginCounter) {
    const userData = {
        last_logged_at: new Date(),
        login_counter: loginCounter + 1
    };

    const mysql = connection.get();

    db.updateAccountByUUID(mysql, userData, uuid, function (err, result) {
        if (err) {
            winston.error(err);
            return;
        }

        winston.verbose('Updated last logged info into `user` table record:', uuid);
    });
}

function register(req, res) {
    req.assert('nickname', 'screen name is required').len(2, 20).withMessage('Must be between 2 and 10 chars long').notEmpty();
    req.assert('account_id', 'Email as User ID field is not valid').notEmpty().withMessage('User ID is required').isEmail();
    req.assert('account_password', 'Password must be at least 4 characters long').len(4);
    req.assert('password_check', 'Password Check must be same as password characters').notEmpty().withMessage('Password Check field is required').equals(req.body.account_password);

    const errors = req.validationErrors();

    if (errors) {
        req.flash('error', errors);
        return res.redirect('back');
    }

    req.sanitize('nickname').escape();
    req.sanitize('account_password').trim();

    findAuthByUserID(req.body.account_id, function (err, account) {

        if (account) {
            req.flash('error', {msg: '이미 존재하는 계정입니다.'});
            return res.redirect('back');
        }

        // var hash = common.hash(req.body.password);
        common.hash(req.body.account_password, function (err, hash) {
            const authData = {
                user_id: req.body.account_id,
                user_password: hash
            };

            const mysql = connection.get();

            // save to auth table
            db.writeAuth(mysql, authData, function (err, result) {
                if (err) {
                    req.flash('error', {msg: '계정 정보 저장에 실패했습니다.'});
                    req.flash('error', {msg: err.toString()});

                    winston.error(err);

                    return res.redirect('back');
                }

                const auth_id = result['insertId'];

                // save to user table
                const userData = {
                    uuid: common.UUID4(),
                    auth_id: auth_id,
                    nickname: req.body.nickname,
                    level: 1,
                    grant: '',
                    login_counter: 0,
                    last_logged_at: new Date(),
                    created_at: new Date()
                };

                req.flash('info', 'Saved Account by ' + userData.nickname, '(' + authData.user_id + ')');

                db.writeAccount(mysql, userData, function (err, result) {
                    if (err) {
                        req.flash('error', {msg: '사용자 정보 저장에 실패했습니다.'});

                        winston.error(error);

                        res.redirect('back');
                    }

                    const id = result['insertId'];

                    const user = {
                        id: id,
                        uuid: userData.uuid,
                        user_id: authData.user_id,
                        nickname: userData.nickname,
                        level: userData.level,
                        grant: userData.grant
                    };

                    counter.insertSessionCounter(token.account.join);

                    req.logIn(auth_id, function (err) {
                        if (err) {
                            req.flash('error', {msg: '로그인 과정에 문제가 발생했습니다.'});

                            winston.error(error);

                            return res.redirect('back');
                        }

                        // insert login logging
                        insertLastLog(user.uuid, userData.login_counter);

                        const agent = useragent.parse(req.headers['user-agent']);
                        counter.insertAccountCounter(user.uuid, token.account.login, agent, req.device);

                        res.redirect('/');
                    });
                });
            });
        });
    });
}

function registerSimpleForTest(req, res) {
    req.assert('nickname', '닉네임이 필요합니다. 최소 2 자에서 최대 10 자까지 사용할 수 있습니다.').len(2, 20);
    req.assert('account_id', '이메일 형식의 사용자 아이디가 필요합니다.').isEmail();
    req.assert('account_password', '패스워드는 최소 4 자 이상의 문자열을 사용해주세요.').len(4);

    const errors = req.validationErrors();

    if (errors) {
        if (Array.isArray(errors)) {
            errors.map(function (item) {
                winston.error(item);
            });
        }
        req.flash('error', errors);
        return res.redirect('back');
    }

    req.sanitize('nickname').escape();
    req.sanitize('account_password').trim();

    // this routine have to warn a message 'Can't Find by This userID' for making new account
    findAuthByUserID(req.body.account_id, function (err, account) {
        if (account) {
            req.flash('error', {msg: '이미 존재하는 계정입니다.'});
            return res.redirect('back');
        }

        // var hash = common.hash(req.body.password);
        common.hash(req.body.account_password, function (err, hash) {
            const authData = {
                user_id: req.body.account_id,
                user_password: hash
            };

            const mysql = connection.get();

            // save to auth table
            db.writeAuth(mysql, authData, function (err, result) {
                if (err) {
                    req.flash('error', {msg: '계정 정보 저장에 실패했습니다.'});

                    winston.error(err);

                    res.redirect('back');
                }

                const auth_id = result['insertId'];

                // save to user table
                const userData = {
                    uuid: common.UUID4(),
                    auth_id: auth_id,
                    nickname: req.body.nickname,
                    level: 9,
                    grant: 'AMC',
                    login_counter: 0,
                    last_logged_at: new Date(),
                    created_at: new Date()
                };

                req.flash('info', 'Saved Account by ' + userData.nickname, '(' + authData.user_id + ')');

                db.writeAccount(mysql, userData, function (err, result) {
                    if (err) {
                        req.flash('error', {msg: '사용자 정보 저장에 실패했습니다.'});

                        winston.error(error);

                        res.redirect('back');
                    }

                    const id = result['insertId'];

                    const user = {
                        id: id,
                        uuid: userData.uuid,
                        user_id: authData.user_id,
                        nickname: userData.nickname,
                        level: userData.level,
                        grant: userData.grant
                    };

                    counter.insertSessionCounter(token.account.join);

                    if (req.query['q'] =='admin' || req.query['q'] == 'manage') {
                        winston.info('Added new account', user);

                        return res.redirect('/' + req.query['q']);
                    }

                    req.logIn(auth_id, function (err) {
                        if (err) {
                            req.flash('error', {msg: '로그인 과정에 문제가 발생했습니다.'});

                            winston.error(error);

                            return res.redirect('back');
                        }

                        // insert login logging
                        insertLastLog(user.uuid, userData.login_counter);

                        const agent = useragent.parse(req.headers['user-agent']);
                        counter.insertAccountCounter(user.uuid, token.account.login, agent, req.device);

                        res.redirect('/');
                    });
                });
            });
        });
    });
}

function showInfo(req, res) {
    const params = {
        title: '정보수정',
        message: req.flash()
    };

    findAccountByUUID(req.user.uuid, function (error, userData) {
        if (error) {
            req.flash('error', {msg: '세션 정보를 찾을 수 없습니다.'});
            return res.redirect('back');
        }

        params.userInfo = userData;
        params.userInfo.created_at = moment(new Date(userData.created_at)).format('LLL');

        res.render(BLITITOR.site.theme + '/page/account/user_info', params);
    });
}

function updateInfo(req, res) {
    const params = {
        updatePassword: false,
        updateProfileImage: false,
    };

    let profileImage = null;

    // console.log(req.body, req.files);

    req.assert('nickname', 'screen name is required').len(2, 20).withMessage('Must be between 2 and 10 chars long').notEmpty();

    if (req.body.account_password/* && (req.body.password.toString().length >= 4)*/) {
        req.assert('account_password', 'Password must be at least 4 characters long').len(4);
        req.assert('password_check', 'Password Check must be same as password characters').notEmpty().withMessage('Password Check field is required').equals(req.body.account_password);

        params.updatePassword = true;
        // params.password = common.hash(req.body.password);
    }

    const errors = req.validationErrors();

    if (errors) {
        winston.error(errors, errors.length);
        req.flash('error', errors);
        return res.redirect('back');
    }

    req.sanitize('nickname').escape();

    let UUID = req.user.uuid;

    if (!UUID) {
        req.flash('error', {msg: 'No Session Info Exist!'});

        return res.redirect('back');
    }

    const userData = {
        nickname: req.body.nickname,
        level: 2,
        grant: 'M',
        updated_at: new Date()
    };

    if (req.files[0] && req.files[0].fieldname == 'profile_image') {
        params.updateProfileImage = true;

        profileImage = req.files[0];

        mkdirp(path.join('public', 'upload', UUID), function (err) {
            if (err) winston.error('Error in Make user folder');

            // move to user folder from temp
            fs.renameSync(req.files[0].path, path.join('public', 'upload', UUID, profileImage.filename));

            // set file info to database
            userData.photo = profileImage.filename;
        });
    }

    const mysql = connection.get();

    db.readAuthIDByUUID(mysql, UUID, function (err, account) {
        if (err) {
            req.flash('error', {msg: err});

            winston.error(err);

            return res.redirect('back');
        }

        const authID = account.auth_id;

        // update auth table, it is async routine
        if (params.updatePassword) {
            common.hash(req.body.account_password, function (err, hash) {
                if (err) {
                    req.flash('error', {msg: err});

                    winston.error(err);

                    // if password update routine was broken
                    // then pass this process for next login
                    // it can use before password
                } else {
                    const authData = { user_password: hash };

                    db.updateAuthByID(mysql, authData, authID, function (err, result) {
                        winston.warn('Updated user password into `auth` table record:', result);
                    });
                }
            });
        }

        // update file associate table
        if (params.updateProfileImage) {
            // replace new profile photo to old one

        }

        db.updateAccountByUUID(mysql, userData, UUID, function (err, result) {
            if (err) {
                req.flash('error', {msg: err});

                winston.error(err);

                return res.redirect('back');
            }

            winston.warn('Updated user info into `user` table record:', result);

            req.flash('info', {msg: '개인 정보가 갱신되었습니다.'});

            return res.redirect('/account/info');
        });
    });
}

function signIn(req, res) {
    // sign in and grant user access level
    // var prevLocation = '/';
    // res.redirect(prevLocation);

    const params = {
        title: "Home",
        q: req.query.q
    };

    if (params.q !== undefined && params.q !== '') {
        req.session.previousURL = params.q.toString();
    }

    res.render(BLITITOR.site.theme + '/page/account/sign_in', params);
}

function signUp(req, res) {
    // var prevLocation = '/';
    // res.redirect(prevLocation);

    const params = {
        title: "Home",
    };

    res.render(BLITITOR.site.theme + '/page/account/sign_up', params);
}

function signOut(req, res) {
    counter.insertSessionCounter(token.account.logout);

    res.clearCookie('remember_me');     // clear the remember me cookie when logging out
    req.logOut();   // it aliased as req.logout()
    res.redirect('/');
    winston.info('signed out');
}

// check for available auth id or nickname, etc
function checkToken(req, res) {
    const params = {
        type: req.query('type'),
        email: req.body.account_id,
        nickname: req.body.nickname
    };

    const mysql = connection.get();

    switch (params.type) {
        case 'u':
            db.readAuthByUserID(mysql, params.email, function (err, auth) {
                if (err || !auth) {
                    // return Error("Can't Auth by This userID");
                    return res.send({status: "success", data: err})
                }
            });

            break;

        case 'n':
            db.readAccountByNickname(mysql, params.nickname, function (err, user) {
                if (err || !user) {
                    // return Error("Can't Auth by This userID");
                    return res.send({status: "success", data: err})
                }
            });

            break;
    }

    res.send({status: "fail", result: params});
}

module.exports = {
    insertLastLog: insertLastLog,
    register: register,
    registerSimple: registerSimpleForTest,
    infoForm: showInfo,
    updateInfo: updateInfo,
    signIn: signIn,
    signUp: signUp,
    signOut: signOut,
    checkToken: checkToken,
    findAuthByUserID: findAuthByUserID,
    findUserByID: findAccountByID,
    findUserByUUID: findAccountByUUID,
    findUserByAuthID: findAccountByAuthID
};
