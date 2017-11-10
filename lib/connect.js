import { resolve } from 'dns';

'use strict'

/**
 * @author WXP
 * @description mq相关
 */

const amqp = require('amqplib');
const Promise = require('bluebird');
const EventEmitter = require('events');
const debug = require('debug')('mq-simple');
const CONNECT_STATUS = {
    //未连接
    UNCONNECTED: 0,
    //连接中
    CONNECTING: 10,
    //已连接
    CONNECTED: 99
};
// 事件
const EVENTS = {
    // 创建成功
    CONNECT_SUCCESS: 'CONNECT_SUCCESS'
}

/**
 * MQ类，建立channel
 * @constructor
 */
class Connect extends EventEmitter {
    constructor(socketOption) {
        // amqplib 的URL为amqp://account:pwd@host:port/vhost
        super();
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
        this.EVENTS = EVENTS;
        this.connect = this.connect.bind(this);
        this.createChannel = this.createChannel.bind(this);
        this.createConfirmChannel = this.createConfirmChannel.bind(this);
        this.close = this.close.bind(this);
        this.reconnect = this.reconnect.bind(this);
    }
    /**
     * 连接服务器
     */
    connect() {
        var that = this;
        if (that.__status == CONNECT_STATUS.CONNECTED) {
            return Promise.resolve(that);
        }
        return Promise.resolve()
            .then(function () {
                // 当连接存在时关闭连接重新开启，否则会出现连接波动，客户端被断开无法连接
                if (!that.conn) {
                    return;
                } else {
                    let events = Object.keys(this.__listener);
                    for (let event of events) {
                        let listeners = this.__listener[event];
                        for (let listener of listeners) {
                            this.conn.removeListener(event, listener);
                        }
                    }
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
                    // 为防止内存泄漏，把所有的监听器都移除
                    if (conn.removeAllListeners) {
                        conn.removeAllListeners();
                    }
                });
                debug('mq connect success');
                that.conn = conn;
                // 发送连接成功消息
                that.emit(EVENTS.CONNECT_SUCCESS);
                return that;
            })
    }

    /**
     * 创建通道
     */
    createChannel() {
        return this.connect()
            .then(() => {
                return this.conn.createChannel();
            })
    }

    /**
     * 创建确认通道
     */
    createConfirmChannel() {
        return this.connect()
            .then(() => {
                return this.conn.createConfirmChannel();
            })
    }

    /**
     * 关闭连接
     */
    close() {
        return this.connect()
            .then(() => {
                return this.conn.close()
            })
            .then(() => {
                this.__status = CONNECT_STATUS.UNCONNECTED;
                return this;
            })
    }

    /**
     * 绑定事件 由于断线重连机制，所以保存了对应的事件
     * @param {string} event 
     * @param {function} listener 
     */
    listen(event, listener) {
        this.conn.on(event, listener);
        if (this.__listener[event]) {
            this.__listener[event].push(listener);
        } else {
            this.__listener[event] = [listener];
        }
    }
    /**
     * 重连
     */
    reconnect() {
        switch (this.__status) {
            // 如果成功结束
            case CONNECT_STATUS.CONNECTED:
                return Promise.resolve(this);
                // 如果连接中等待结果
            case CONNECT_STATUS.CONNECTING:
                return new Promise(() => {
                    process.nextTick((resolve, reject) => {
                        this.reconnect()
                            .then(() => {
                                resolve(this);
                            })
                            .catch((error) => {
                                reject(error);
                            })
                    })
                })
                // 如果失败重新连接
            case CONNECT_STATUS.UNCONNECTED:
                this.__status = CONNECT_STATUS.CONNECTING;
                return this.connect()
                    .then(() => {
                        // 重连后由于对象变更，原事件重新绑定
                        let events = Object.keys(this.__listener);
                        for (let event of events) {
                            let listeners = this.__listener[event];
                            for (let listener of listeners) {
                                this.conn.on(event, listener);
                            }
                        }
                        return this;
                    });

        }
    }
}

module.exports = Connect;