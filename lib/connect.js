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
        this.__listeners = {};
        this.EVENTS = EVENTS;
        this.STATUS = CONNECT_STATUS;
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
        switch (that.status) {
            // 如果成功结束
            case CONNECT_STATUS.CONNECTED:
                return Promise.resolve(that);
                // 如果连接中等待结果
            case CONNECT_STATUS.CONNECTING:
                return new Promise(() => {
                    process.nextTick((resolve, reject) => {
                        that.connect()
                            .then(() => {
                                resolve(that);
                            })
                            .catch((error) => {
                                reject(error);
                            })
                    })
                })
        }
        // 状态为未连接则开始连接
        that.status = CONNECT_STATUS.CONNECTING;
        return Promise.resolve()
            .then(function () {
                // 当连接存在时关闭连接重新开启，否则会出现连接波动，客户端被断开无法连接
                if (!that.conn) {
                    return;
                } else {
                    // 是否需要解绑事件以防止内存泄漏，但是只解绑已知事件依然无法释放内存
                    // let events = Object.keys(this.__listeners);
                    // for (let event of events) {
                    //     let listeners = this.__listeners[event];
                    //     for (let listener of listeners) {
                    //         this.conn.removeListener(event, listener);
                    //     }
                    // }
                    return that.conn.close()
                        .catch(function () {
                            return ''
                        });
                }
            })
            .then(function () {
                return amqp.connect(that.__url, that.__socketOption);
            })
            .then(function (conn) {
                if (!conn) {
                    that.status = CONNECT_STATUS.UNCONNECTED;
                    throw ('获取连接失败');
                }
                conn.on('error', function (error) {
                    error = error || {
                        message: 'mq connect error',
                        stack: 'none'
                    };
                    debug('connect error，message:' + error.message);
                });
                //一般error事件之后会捕捉到close事件
                conn.on('close', function (error) {
                    that.status = CONNECT_STATUS.UNCONNECTED;
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
                let events = Object.keys(that.__listeners);
                for (let event of events) {
                    let listeners = that.__listeners[event];
                    for (let listener of listeners) {
                        that.conn.on(event, listener);
                    }
                }
                that.status = CONNECT_STATUS.CONNECTED;
                // 发送连接成功消息
                that.emit(EVENTS.CONNECT_SUCCESS);
                return that;
            })
            .catch((error) => {
                that.status == CONNECT_STATUS.UNCONNECTED;
                throw (error);
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
                this.status = CONNECT_STATUS.UNCONNECTED;
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
        if (this.__listeners[event]) {
            this.__listeners[event].push(listener);
        } else {
            this.__listeners[event] = [listener];
        }
    }
    /**
     * 重连
     * 1.断线
     * 2.重连
     */
    reconnect() {
        return this.close()
            .then(() => {
                return this.connect();
            })
    }
}

module.exports = Connect;