'use strict'

/**
 * @author WXP
 * @description 队列相关
 */
const Channel = require('./channel');
const Connect = require('./connect');
const Promise = require('bluebird');

class Queue extends Channel {
    constructor(name, options, connect) {
        if (options instanceof Connect) {
            connect = options;
            options = {};
        }
        super(connect, {
            prefetchCount: options.prefetchCount || 1
        });
        Object.defineProperty(this, 'name', {
            writable: false,
            value: name
        });
        this.__consumers = [];
        // 默认保持链接
        options.keepAlive = options.keepAlive || true;
        this.__options = Object.assign({}, options);
        let that = this;
        if (this.__options.keepAlive) {
            this.__listeners.close = this.__listeners.close || [];
            this.__listeners.close.push((data) => {
                console.error(`id:${that.ch.id} queue ${that.name} closed, message: ${data}`);
                that.connect();
            });
        }
        this.__listeners.error = [(err) => {
            console.error(`queue ${that.name} error, message: ${err.message}`);
        }];
    }
    connect() {
        return super.createChannel()
            .then(() => {
                let that = this;
                let consume = super.consume;
                return Promise.each(this.__consumers, (consumer) => {
                    return consume.call(that, that.name, consumer.consumer, consumer.options)
                })
            })
            .then(() => {
                return this;
            })
    }
    consume(handler, options) {
        let queue = this;
        options = Object.assign({}, options)
        let formater = initConsumeFormater(queue.__options);
        let consumer = function (msg) {
            msg = formater(msg);
            handler(msg);
        }
        return super.consume.call(this, this.name, consumer, options)
            .then(() => {
                this.__consumers.push({
                    consumer: consumer,
                    options: options
                });
                return this;
            })
    }
    publish() {
        throw ('it\'s not a function for queue, it\'s an exchange\'s function!');
    }
    // 
    sendToQueue() {
        return super.sendToQueue.apply(this, [this.name].concat(Array.from(arguments)));
    }
    // 重连方法
    reconect() {
        return super.close()
            .then(this.connect)
    }
}

function initConsumeFormater(opt) {
    return function (msg) {
        let data;
        // 当传输数据类型为application/json或者自动parse时parse，否则不处理
        if (opt.isAutoParse || msg.properties.contentType === 'application/json') {
            try {
                data = JSON.parse((msg.content).toString());
            } catch (e) {
                data = msg.data;
            }
        }
        msg.data = data;
        return msg;
    }
}

module.exports = Queue;