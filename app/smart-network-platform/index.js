// load packages
var express = require('express');

// load cores
var misc = require('../../core/lib/misc');

// load modules
var Site = require('../../module/site');
var AppStore = require('../../module/app_store');
var ControllerHub = require('../../module/controller_hub');
var Account = require('../../module/account');
var Admin = require('../../module/administrator');
var Manager = require('../../module/manager');
var Counter = require('../../module/counter');

// load locals
var app = require('./app.json');
var menu = require('./menu');

// init
var router = express.Router();
var routeTable = misc.getRouteData();
var appLocals = Site.exposeAppLocals(app.locals, menu);

// middleware
router.use(Account.middleware.exposeLocals);
// router.use(Site.middleware.cacheControl);
router.use(Site.middleware.exposeLocals);
router.use(Admin.middleware.exposeMenu);
router.use(Manager.middleware.exposeMenu);

// route
router.use(Admin.route);       // to manage accounts
router.use(Manager.route);     // to view log module

// need to place down here for except admin page log
router.use(Counter.middleware.sessionCounter);
router.use(Counter.middleware.pageCounter);

// bind module
router.use('/account', Account.site);
router.use(AppStore.route);
router.use(ControllerHub.route);

// bind static page
Site.bindMenu(menu, router);

module.exports = {
    exposeLocals: appLocals,
    router: router
};
