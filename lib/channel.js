'use strict'

/**
 * @author WXP
 * @description channel相关，一个connect可以建立多个channel，通过channel与mq服务器交互
 */

const EventEmitter = require('events');
const Promise = require('Promise');
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

class Channel extends EventEmitter {
    /**
     * 通道构造函数
     * @param {Connect} connect 
     * @param {*} option 
     */
    constructor(name, type, connect, option) {
        super();
        this.__connect = connect;
        this.__ch = null;
        this.__status = CONNECT_STATUS.UNCONNECTED;
        this.__listeners = {};
        this.option = Object.assign({}, option);
        this.EVENTS = EVENTS;
        this.name = name;
        this.type = type
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
        return that.__conn.createChannel()
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
                // TODO 绑定事件，是否keepAlive
                return that;
            })
            .catch((error) => {
                that.__status == CONNECT_STATUS.UNCONNECTED;
                throw (error);
            })
    }
    /**
     * 断线后重新连接
     */
    reconnect() {

    }
}

// TODO 打包和绑定方法，用以绑定mq原方法
function pakcageWithName(channel, funcName) {
    // 增加构造方法
    channel[funcName] = function () {
        // 补充上队列或exchange名称
        let args = [channel.name].concat(Array.from(arguments));
        // 判断是否连接
        return channel.createChannel()
            .then(() => {
                // 调用方法
                return channel.ch[funcName].apply(channel.ch, args);
            })
    }
}

module.exports = Channel;