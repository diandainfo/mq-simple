'use strict'

/**
 * @author WXP
 * @description channel相关，一个connect可以建立多个channel，通过channel与mq服务器交互
 */

const EventEmitter = require('events');
const Promise = require('bluebird');
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

const PACKAGE_FUNCTION_NAMES = [
    'close',
    // 'publish',
    // 'sendToQueue',
    'consume',
    'cancel',
    'get',
    'ack',
    'ackAll',
    'nack',
    'nackAll',
    'reject',
    'prefetch',
    'recover'
];

// 重连由子类负责，exchange不需要重连，queue需要
class Channel extends EventEmitter {
    /**
     * 通道构造函数
     * @param {Connect} connect 
     */
    constructor(connect) {
        super();
        this.__connect = connect;
        this.ch = null;
        this.__status = CONNECT_STATUS.UNCONNECTED;
        this.__listeners = {};
        this.EVENTS = EVENTS;
    }

    /**
     * 创建可以通信的通道
     */
    createChannel() {
        let that = this;
        switch (that.__status) {
            case CONNECT_STATUS.CONNECTED:
                return Promise.resolve(that);
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
        return that.__connect.createChannel()
            .then((ch) => {
                that.ch = ch;
                // 重新绑定事件
                let events = Object.keys(that.__listeners);
                for (let event of events) {
                    let listeners = that.__listeners[event];
                    for (let listener of listeners) {
                        that.ch.on(event, listener);
                    }
                }
                that.__status = CONNECT_STATUS.CONNECTED;
                that.ch.on('close', function () {
                    that.__status == CONNECT_STATUS.UNCONNECTED;
                })
                return that;
            })
            .catch((error) => {
                that.__status == CONNECT_STATUS.UNCONNECTED;
                throw (error);
            })
    }
    // 绑定事件
    listen(event, listener) {
        this.ch.on(event, listener);
        if (this.__listeners[event]) {
            this.__listeners[event].push(listener);
        } else {
            this.__listeners[event] = [listener];
        }
    }

    sendToQueue(queue, content, options) {
        return this.createChannel()
            .then(() => {
                let message = initMessage(content, options);
                return this.ch.sendToQueue(queue, message.content, message.options);
            })
    }

    publish(exchange, routingKey, content, options) {
        return this.createChannel()
            .then(() => {
                let message = initMessage(content, options);
                return this.ch.publish(exchange, routingKey, message.content, message.options);
            })
    }

    reconect() {
        return this.close()
            .then(() => {
                return this.createChannel();
            })
    }
    // consume() {
    //     let channel = this;
    //     return channel.createChannel()
    //         .then(() => {
    //             // 调用方法
    //             return channel.ch.consume.apply(channel.ch, arguments);
    //         })
    // }
}

for (let name of PACKAGE_FUNCTION_NAMES) {
    packageWithName(name);
}
// 打包和绑定方法，用以绑定mq原方法
function packageWithName(funcName) {
    // 增加构造方法
    Channel.prototype[funcName] = function () {
        // 补充上队列或exchange名称
        // let args = [channel.name].concat(Array.from(arguments));
        // 判断是否连接
        let channel = this;
        return channel.createChannel()
            .then(() => {
                // 调用方法
                return channel.ch[funcName].apply(channel.ch, arguments);
            })
    }
}

function initMessage(content, options) {
    let ct;
    if (typeof content === 'object' && !(content instanceof Buffer)) {
        try {
            ct = JSON.stringify(content);
            options = options || {};
            options.contentType = options.contentType || 'application/json';
        } catch (error) {
            ct = content;
        }
    }
    if (!(ct instanceof Buffer)) {
        try {
            ct = Buffer.from(ct);
        } catch (error) {
            throw (error);
        }
    }
    return {
        content: ct,
        options: options
    }
}


module.exports = Channel;