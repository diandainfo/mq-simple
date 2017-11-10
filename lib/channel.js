'use strict'

/**
 * @author WXP
 * @description channel相关，一个connect可以建立多个channel，通过channel与mq服务器交互
 */

const EventEmitter = require('events');



class Channel extends EventEmitter {
    /**
     * 通道构造函数
     * @param {Connect} connect 
     * @param {*} option 
     */
    constructor(connect, option) {
        super();
        this.__connect = connect;
        this.__ch = null;
        this.option = Object.assign({}, option);
    }
    createChannel() {
        this.__conn.createChannel()
            .then((ch) => {
                this.__ch = ch;
            })
    }
}

module.exports = Channel;