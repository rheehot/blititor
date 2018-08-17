var fs = require('fs');
var path = require('path');
var moment = require('moment');
var winston = require('winston');

var childProcess = require('child_process');

var common = require('../../../core/lib/common');
var misc = require('../../../core/lib/misc');
var connection = require('../../../core/lib/connection');   // todo: can load from CLI modules

var db = require('./database');
var query = require('./query');

var routeData = require('../route.json');
var routeTable = misc.getRouteTable(routeData);
var controllerHubFlag = misc.commonFlag().controllerHub;

var executePath = path.join(BLITITOR.root, 'theme', BLITITOR.site.theme, 'bin');

var consoleCommand = {
    list: path.join(executePath, 'list'),
    create: path.join(executePath, 'create'),
    connect: path.join(executePath, 'connect')
};

function gatewayList(req, res) {
    var params = {
        title: "넷 앱 컨트롤러 허브",
        pinnedNetAppCount: 4,
        pinnedNetAppList: [],
        recentNetAppCount: 8,
        recentNetAppList: [],
        categoryList: []
    };

    var mysql = connection.get();

    db.getGatewayGroupList(mysql, function (error, results) {
        params.groupList = results;
        db.getGatewayList(mysql, function (error, results) {
            results.map(function (item) {
                item.vmList = item.installed_apps && item.installed_apps.split(',').map(function (app) {
                        return app.trim();
                    }).filter(function (app) {
                        return !!app;
                    });
            });

            params.gatewayList = results;

            res.render(BLITITOR.site.theme + '/page/controller_hub/controller_hub', params);
        });
    });
}

function viewGateway(req, res) {
    var params = {
        title: '넷 앱 컨트롤러 허브',
        gateway_id: req.params.gatewayID,
        gatewayInfo: {},
        rtvmList: []
    };

    if (!params.gateway_id) {
        return res.redirect('back');
    }

    var mysql = connection.get();

    db.getGatewayInfo(mysql, Number(params.gateway_id), function (error, result) {
        if (result && result[0]) {
            params.gatewayInfo = result[0];

            var gatewayConnectionInfo = {
                env: {
                    'MANAGER_IP': params.gatewayInfo.gateway_ip,
                    'MANAGER_PORT': params.gatewayInfo.gateway_port
                }
            };

            childProcess.execFile(consoleCommand.list, gatewayConnectionInfo, function (error, stdout, stderr) {
                var result = stdout.toString().replace(/\\n/g, '\n');

                console.log(result);

                db.getRtvmList(mysql, Number(params.gateway_id), function (error, results) {
                    if (!error && results) {
                        params.rtvmList = results;
                    }

                    res.render(BLITITOR.site.theme + '/page/controller_hub/gateway', params);
                });
            });
        } else {
            throw Error('no gateway information');
        }
    });
}

function gatewayForm(req, res) {
    var params = {
        title: '신규 게이트웨이 생성',
        groupList: []
    };

    var mysql = connection.get();

    db.getGatewayGroupList(mysql, function (error, results) {
        params.groupList = results;

        res.render(BLITITOR.site.theme + '/page/controller_hub/gateway_form', params);
    });
}

function newGateway(req, res) {
    req.assert('gateway_ip', 'gateway ip is required').notEmpty();

    var errors = req.validationErrors();

    if (errors) {
        req.flash('error', errors);

        return res.redirect('back');
    }

    req.sanitize('group_id').escape();
    req.sanitize('description').escape();

    var gatewayData = {
        gateway_uuid: common.UUID1(),
        gateway_ip: req.body.gateway_ip,
        gateway_port: req.body.gateway_port,
        group_id: Number(req.body.group_id) || 0,
        title: req.body.title,
        description: req.body.description,
        secret_string: req.body.secret_string,
        created_at: new Date()
    };

    var mysql = connection.get();

    db.createGateway(mysql, gatewayData, function (error, result) {
        res.redirect(routeTable.controller_hub_root);
    });
}

function newGatewayGroup(req, res) {
    req.assert('group_title', 'title is required').notEmpty();

    var errors = req.validationErrors();

    if (errors) {
        req.flash('error', errors);

        return res.redirect('back');
    }

    req.sanitize('group_title').escape();
    req.sanitize('group_subject').escape();
    req.sanitize('group_tag').escape();

    var gatewayGroupData = {
        flag: controllerHubFlag.gatewayGroup.normal,
        group_title: req.body.group_title,
        group_subject: req.body.group_subject,
        group_tag: req.body.group_tag,
        group_image: req.body.group_image || '//placeimg.com/50/50/' + common.randomNumber(1),
        created_at: new Date()
    };
    
    var mysql = connection.get();

    db.createGroup(mysql, gatewayGroupData, function (error, result) {
        res.redirect(routeTable.controller_hub_root);
    });
}

function rtvmForm(req, res) {
    var params = {
        title: '신규 가상머신 생성',
        gateway_id: req.query.q,
        groupInfo: {}
    };

    if (!params.gateway_id) {
        return res.redirect('back');
    }

    var mysql = connection.get();

    db.getGatewayInfo(mysql, Number(params.gateway_id), function (error, result) {
        if (result && result[0]) {
            params.gatewayInfo = result[0];
        }

        res.render(BLITITOR.site.theme + '/page/controller_hub/rtvm_form', params);
    });
}

function newRtvm(req, res) {
    req.assert('rtvm_title', 'vm title is required').notEmpty();
    req.assert('gateway_id', 'gateway ID is required').notEmpty();

    var errors = req.validationErrors();

    if (errors) {
        req.flash('error', errors);

        return res.redirect('back');
    }

    req.sanitizeBody('rtvm_title').escape();
    req.sanitizeBody('rtvm_description').escape();
    req.sanitizeBody('gateway_id').escape();

    var mysql = connection.get();

    db.getGatewayInfo(mysql, Number(req.body.gateway_id), function (error, result) {
        if (result && result[0]) {
            var gatewayInfo = result[0];

            var gatewayConnectionInfo = {
                env: {
                    'MANAGER_IP': gatewayInfo.gateway_ip,
                    'MANAGER_PORT': gatewayInfo.gateway_port
                }
            };

            childProcess.execFile(consoleCommand.create, gatewayConnectionInfo, function (error, stdout, stderr) {
                var stringArray = stdout.toString().split('\n').filter(function (str) {
                    return str;
                });

                var rtvmID = stringArray[stringArray.length - 1];

                var rtvmData = {
                    gateway_id: req.body.gateway_id,
                    rtvm_uuid: rtvmID || common.UUID1(),
                    title: req.body.rtvm_title,
                    core_count: req.body.rtvm_core_count,
                    vm_memory_size: req.body.rtvm_memory_size,
                    vm_storage_size: req.body.rtvm_storage_size,
                    nic_dev: req.body.rtvm_nic_dev,
                    nic_mac: req.body.rtvm_nic_mac,
                    nic_input_buffer_size: req.body.rtvm_nic_input_buffer,
                    nic_output_buffer_size: req.body.rtvm_nic_output_buffer,
                    nic_input_bandwidth_size: req.body.rtvm_nic_input_bandwidth,
                    nic_output_bandwidth_size: req.body.rtvm_nic_output_bandwidth,
                    nic_head_padding_size: req.body.rtvm_nic_head_padding,
                    nic_tail_padding_size: req.body.rtvm_nic_tail_padding,
                    nic_pool_size: req.body.rtvm_nic_pool_size,
                    vm_description: req.body.rtvm_description,
                    created_at: new Date()
                };

                db.createRtvm(mysql, rtvmData, function (error, result) {
                    console.log(error, result);
                    res.redirect(routeTable.controller_hub_root + routeTable.controller_hub.gateway + '/' + rtvmData.gateway_id);
                });
            });

        } else {
            throw Error('no gateway information');
        }
    });
}

function rtvm(req, res) {
    console.log(req.body);

    res.send(req.body);
}

module.exports = {
    index: gatewayList,
    gatewayForm: gatewayForm,
    view: viewGateway,
    newGateway: newGateway,
    newGatewayGroup: newGatewayGroup,
    rtvmForm: rtvmForm,
    newRtvm: newRtvm,
    rtvm: rtvm
};
