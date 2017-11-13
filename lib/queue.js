'use strict'

/**
 * @author WXP
 * @description 队列相关
 */
const Channel = require('./channel');
const Connect = require('./connect');

class Queue extends Channel {
    constructor(name, option, connect) {
        if (option instanceof Connect) {
            connect = option;
            option = {};
        }
        super(connect);
        Object.defineProperty(this, 'name', {
            writable: false,
            value: name
        });
        this.__consumers = [];
        // 默认保持链接
        option.keepAlive = option.keepAlive || true;
        this.__option = Object.assign({}, option);
        if (this.__option.keepAlive) {
            let queue = this;
            this.listeners.close = [(data) => {
                console.error(`queue ${queue.name} closed, message: ${data}`);
                queue.connect();
            }];
            this.listeners.error = [(err) => {
                console.error(`queue ${queue.name} error, message: ${err.message}`);
            }];
        }
    }
    connect() {
        return super.createChannel()
            .then(() => {
                if (this.__option.prefetchCount) {
                    return this.prefetch(this.__option.prefetchCount)
                }
            })
            .then(() => {
                let queue = this;
                let consume = super.consume
                return Promise.each(this.__consumers, (consumer) => {
                    return consume.call(queue, queue.name, consumer.consumer, consumer.options)
                })
            })
            .then(() => {
                return this;
            })
    }
    consume(handler, options) {
        let queue = this;
        options = Object.assign({}, options)
        let formater = initConsumeFormater(queue.__option);
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