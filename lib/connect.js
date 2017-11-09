'use strict'

/**
 * @author WXP
 * @description mq相关
 */

const amqp = require('amqplib');
const Promise = require('bluebird');
const debug = require('debug')('mq-simple');
const CONNECT_STATUS = {
    //未连接
    UNCONNECTED: 0,
    //连接中
    CONNECTING: 10,
    //已连接
    CONNECTED: 99
};

/**
 * MQ类，建立channel
 * @constructor
 */
var Connect = {
    constructor(socketOption) {
        // amqplib 的URL为amqp://account:pwd@host:port/vhost
        let __socketOption = {};
        let __url = 'amqp://';
        if ('account' in socketOption) {
            __url += encodeURIComponent(socketOption.account);
            if ('password' in socketOption) {
                __url += ':' + encodeURIComponent(socketOption.password);
            }
            __url += '@';
        }
        __url += socketOption.host;
        if ('port' in socketOption) {
            __url += ':' + socketOption.port;
        }
        if ('vHost' in socketOption) {
            __url += socketOption.vHost;
        }
        Object.keys(socketOption)
            .forEach(function (key) {
                if (['url', 'account', 'password', 'vhost'].indexOf(key) !== -1) {
                    __socketOption[key] = socketOption[key];
                }
            });
        this.socketOption = socketOption;
        this.__socketOption = __socketOption;
        this.__url = __url;
        this.__listener = {};
    },

    /**
     * 链接上服务器
     */
    connect() {
        var that = this;
        if (that.__status == CONNECT_STATUS.connected) {
            return Promise.resolve(that);
        }
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
                that.__status = CONNECT_STATUS.CONNECTING;
                return amqp.connect(that.__url, that.__socketOption);
            })
            .then(function (conn) {
                if (!conn) {
                    that.__status = CONNECT_STATUS.UNCONNECTED;
                    throw ('获取连接失败');
                }
                conn.on('error', function (error) {
                    error = error || {
                        message: 'mq connect error',
                        stack: 'none'
                    };
                    that.__status = CONNECT_STATUS.UNCONNECTED;
                    debug('connect error，message:' + error.message);
                });
                //一般error事件之后会捕捉到close事件
                conn.on('close', function (error) {
                    error = error || {
                        message: 'mq connect fail',
                        stack: 'none'
                    };
                    debug(' connect cloesd，message:' + error.message);
                });
                debug('mq connect success');
                that.conn = conn;
                return that;
            })
    },

    /**
     * 创建通道
     */
    createChannel() {
        return this.conn.createChannel();
    },

    /**
     * 创建确认通道
     */
    createConfirmChannel() {
        return this.conn.createConfirmChannel();
    },

    /**
     * 关闭链接
     */
    close() {
        return this.conn.close()
            .then(function () {
                this.__status = false;
            })
    },

    /**
     * 绑定事件 由于断线重连机制，所以保存了对应的事件
     * @param {string} event 
     * @param {function} callback 
     */
    on(event, callback) {
        this.conn.on(event, callback);
        if (this.__listener[event]) {
            this.__listener[event].push(callback);
        } else {
            this.__listener[event] = [callback];
        }
    }
}

module.exports = Connect;