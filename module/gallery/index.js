const lib = require('./lib/gallery');
const { site } = require('./route');
const middleware = require('./lib/middleware');

module.exports = lib;
module.exports.site = site;
module.exports.middleware = middleware;
