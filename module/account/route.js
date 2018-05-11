var express = require('express');
var winston = require('winston');

var Passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var misc = require('../../core/lib/misc');

var account = require('./lib/account');
var middleware = require('./lib/middleware');
var passport = require('./lib/passport');

var router = express.Router();
var routeTable = misc.getRouteData();

// Passport Stuffs
var passportLocalOptions = {
    failureRedirect: '/account' + routeTable.account.signIn,
    badRequestMessage: '아이디 또는 비밀번호를 입력해주세요!',
    failureFlash: true,
};

Passport.use(new LocalStrategy({ usernameField: 'account_id', passwordField: 'account_password' }, passport.authenticate));
Passport.serializeUser(passport.serialize);
Passport.deserializeUser(passport.deserialize);

router.use(middleware.exposeLocals);

router.get(routeTable.account.signIn, account.signIn);
router.get(routeTable.account.signUp, middleware.checkLoggedSession, account.signUp);
router.get(routeTable.account.signOut, account.signOut);
router.post(routeTable.account.checkToken, account.checkToken);

router.post(routeTable.account.login, Passport.authenticate('local', passportLocalOptions), passport.loginSuccess, passport.loginDone);
router.post(routeTable.account.register, account.register);

router.get(routeTable.account.info, middleware.checkSignedIn, account.infoForm);
router.post(routeTable.account.updateInfo, middleware.checkSignedIn, account.updateInfo);

module.exports = router;