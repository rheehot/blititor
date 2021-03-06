var winston = require('winston');

function exposeLocals(req, res, next) {
    winston.verbose('bind locals in slack: { }');
    next();
}

module.exports = {
    exposeLocals: exposeLocals
};