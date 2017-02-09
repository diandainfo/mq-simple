var amqp = require('amqplib'),
    util = require('util'),
    Promise = require('bluebird'),
    debug = require('debug')('mq-simple'),
    _ = require('lodash'),
    Mq = require('./Mq'),
    CONNECT_STATUS = Mq.CONNECT_STATUS;
/**
 * 队列
 * @param config 数据库配置
 * {
 *      host:地址
 *      account:账号
 *      password:密码
 *
 * }
 * @param options 配置参数
 * {
 *      queueName:队列名
 *      vHost:虚拟地址
 *      prefetchCount:单次最大接受长度 默认为0 设置为1时 1条消息acknowledge第二条消息才会收到
 *      rabbitmq其它配置参数
 * }
 * @constructor
 */

var Queue = function (config, options) {
    //获取Mq的配置
    Mq.call(this, config, options);
    this.queue = options.queueName;
    this.consumers = [];
    this.isAlive = false;
    this.options = options || {};
};

//使Queue继承Mq
util.inherits(Queue, Mq);

/**
 * 创建队列
 * @returns {*}
 */
Queue.prototype.createQueue = (function () {
    function createQueue() {
        var queue = this;
        if (queue.isAlive) {
            return Promise.resolve(queue);
        }
        //建立通道
        return queue.createChannel({
                noAck: false
            })
            // 检查队列是否存在
            .then(function () {
                return queue.channel.checkQueue(queue.queue)
                    .then(function (data) {
                        if (!data) {
                            queue.isAlive = false;
                            throw (queue.queue + '队列不存在');
                        }
                        return Promise.resolve(queue);
                    })
            })
            //绑定异常事件
            .then(function () {
                debug('queue：' + queue.queue + ' create success');
                queue.isAlive = true;
                queue.channel.on('error', function (error) {
                    error = error || {
                        message: 'none',
                        stack: 'none'
                    };
                    debug('queue：', queue.queue + 'error，message:' +
                        error.message + ' \nstack:' + error.stack);
                });
                //一般error事件之后会捕捉到close事件
                queue.channel.on('close', function (error) {
                    queue.isAlive = false;
                    queue._status = CONNECT_STATUS.unconnected;
                    error = error || {
                        message: 'none',
                        stack: 'none'
                    };
                    debug('queue：', queue.queue + 'error，message:' +
                        error.message + ' \nstack:' + error.stack);
                    queue.createQueue();
                });
                return Promise.resolve(queue);
            })
            //绑定消费者
            .then(function () {
                return Promise.each(queue.consumers, function (par) {
                    queue.consume(par);
                });
            })
            //完成
            .then(function () {
                return Promise.resolve(queue);
            })
            .catch(function (erorr) {
                debug('connect failed ：' + erorr.message +
                    ' \nstack:' + erorr.stack);
                return Promise.reject(erorr);
            });
    }

    return function () {
        var queue = this;
        if (queue._status == CONNECT_STATUS.connected) {
            return Promise.resolve(queue);
        }
        if (queue._status == CONNECT_STATUS.connecting) {
            return Promise
                .delay(1000)
                .then(function () {
                    console.log('mq-connect:queue-' + queue.queue + ': waiting....');
                    return queue.createQueue();
                })
                .catch(function () {
                    return queue.createQueue();
                });
        } else {
            queue._status = CONNECT_STATUS.connecting;
            return createQueue.call(queue)
                .catch(function (error) {
                    console.log('mq-connect:queue-' + queue.queue + ': failed');
                    queue._status = CONNECT_STATUS.unconnected;
                    return queue.createQueue();
                });
        }
    };
})();

/**
 * 检查队列状态
 * @returns {Promise|*}
 */
Queue.prototype.check = function () {
    var queue = this;
    return queue.channel.checkQueue(queue.queue)
        .then(function (data) {
            if (!data) {
                queue.isAlive = false;
                throw ('队列已经关闭');
            }
            return Promise.resolve(queue);
        });
};

/**
 * 发送消息
 * @param message
 * @returns {Promise|*}
 */
Queue.prototype.sendToQueue = function (message) {
    var queue = this;
    if (typeof message == 'object') {
        message = JSON.stringify(message);
    }
    message = new Buffer(message + '', 'utf8');
    return queue.createQueue()
        .then(function () {
            return queue.channel.sendToQueue(queue.queue, message);
        });
};

/**
 * 获取消息
 * @returns {Promise|*}
 */
Queue.prototype.get = function () {
    var queue = this;
    return queue.createQueue()
        .then(function () {
            return queue.channel.get(queue.queue, {
                noAck: false
            });
        })
        .then(function (data) {
            data.value = data.content.toString();
            return Promise.resolve(data);
        });
};

/**
 * 作为一个消费者绑定队列
 */
Queue.prototype.consume = function (callback) {
    var queue = this;
    return queue.createQueue()
        .then(function () {
            //将消费者放入消费者数组中，当重连时可以继续绑定
            return queue.channel.consume(queue.queue, function (msg) {
                var data = msg && msg.content.toString() || '{}';
                try {
                    data = JSON.parse(data);
                } catch (error) {

                }
                callback(data, msg);
            }, {
                noAck: false
            });
        })
        .then(function () {
            //防止重连时重复绑定
            if (!_.includes(queue.consumers, callback)) {
                queue.consumers.push(callback);
            }
            return Promise.resolve(queue);
        });
};

/**
 * 重新连接
 * @returns {*}
 */
Queue.prototype.reconnect = function () {
    var queue = this;
    if (queue._status == CONNECT_STATUS.connected) {
        queue._status = CONNECT_STATUS.unconnected;
    }
    return queue.createQueue();
};

/**
 * 确认收到方法
 * @param msg 获取到的消息对象
 * @returns {{deliveryTag, multiple}}
 */
Queue.prototype.ack = function (msg) {
    var queue = this;
    return queue.createQueue()
        .then(function () {
            return queue.channel.ack(msg);
        });
};

module.exports = Queue;