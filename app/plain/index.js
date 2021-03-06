// load packages
var express = require('express');

// load cores
var misc = require('../../core/lib/misc');

// load modules
var Chat = require('../../module/chatting');
var Account = require('../../module/account');
var Site = require('../../module/site');

// load locals
var app = require('./app.json');
var menu = require('./menu');

// init
var router = express.Router();
var routeTable = misc.getRouteData();
var appLocals = Site.exposeAppLocals(app.locals, menu);

// middleware
router.use(Account.middleware.exposeLocals);

// route
router.use('/account', Account.site);
router.post('/account' + routeTable.account.registerSimple, Account.middleware.checkLoggedSession, Account.registerSimple);
router.post('/account' + routeTable.account.add, Account.registerSimple);

router.use('/chat', Chat.route);

// init socket.io
Chat.initSocket(BLITITOR._socketIO);

// bind static page
Site.bindMenu(menu, router);

module.exports = {
    config: app.config,
    exposeLocals: appLocals,
    router: router,
};
