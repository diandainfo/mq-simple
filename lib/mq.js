/**
 * Created by wuxp on 2016/3/27.
 */
var amqp = require('amqplib'),
    util = require('util'),
    Promise = require('bluebird'),
    debug = require('debug')('mq-simple'),
    _ = require('lodash'),
    CONNECT_STATUS = {
        //未连接
        unconnected: 0,
        //连接中
        connecting: 10,
        //已连接
        connected: 99
    };

/**
 * MQ类，建立channel
 * @constructor
 */
var Mq = function (config, options) {
    this.config = config;
    this.options = options;
    this.channel = null;
    this._status = CONNECT_STATUS.unconnected;
};

/**
 * 创建channel
 */
Mq.prototype.createChannel = function () {
    var that = this,
        prefetchCount = that.options.prefetchCount || 0,
        host = that.config.host,
        password = that.config.password,
        account = that.config.account,
        vHost = that.options.vHost || '';
    var heartbeat = that.options.heartbeat || 5;
    if (that._status == CONNECT_STATUS.connected) {
        return Promise.resolve(that);
    }
    password = password ? encodeURIComponent(password) : password;
    account = account ? encodeURIComponent(account) : account;
    //vHost需要被转码以应对'/a'的情况
    vHost = vHost ? '/' + encodeURIComponent(vHost) : vHost;
    return Promise.resolve()
        .then(function () {
            // 当链接存在时关闭链接重新开启
            if (!that.conn) {
                return;
            } else {
                return that.conn.close()
                    .catch(function () {
                        return ''
                    });
            }
        })
        .then(function () {
            return amqp.connect('amqp://' + account + ':' + password + '@' + host + vHost, {
                heartbeat: heartbeat
            })
        })
        .then(function (conn) {
            if (!conn) {
                throw ('获取连接失败');
            }
            conn.on('error', function (error) {
                error = error || {
                    message: 'none',
                    stack: 'none'
                };
                debug('connect error，message:' + error.message);
            });
            //一般error事件之后会捕捉到close事件
            conn.on('close', function (error) {
                error = error || {
                    message: 'none',
                    stack: 'none'
                };
                debug(' connect cloesd，message:' + error.message);
            });
            debug('mq connect success');
            that.conn = conn;
            return conn.createChannel();
        })
        .then(function (ch) {
            if (!ch) {
                throw ('建立通道失败');
            }
            that._status = CONNECT_STATUS.connected;
            that.channel = ch;
            debug('mq connect success');
            return ch.prefetch(prefetchCount);
        });
};

Mq.CONNECT_STATUS = CONNECT_STATUS;

module.exports = Mq;