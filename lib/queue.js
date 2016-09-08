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
    if (that._status == CONNECT_STATUS.connected) {
        return Promise.resolve(that);
    }
    password = password ? encodeURIComponent(password) : password;
    account = account ? encodeURIComponent(account) : account;
    //vHost需要被转码以应对'/a'的情况
    vHost = vHost ? '/' + encodeURIComponent(vHost) : vHost;
    return amqp.connect('amqp://' + account + ':' + password + '@' + host + vHost, {
        heartbeat: 1
    })
        .then(function (conn) {
            if (!conn) {
                throw('获取连接失败');
            }
            conn.on('error', function (error) {
                error = error || {message: 'none', stack: 'none'};
                debug('connet error，message:' + error.message);
            });
            //一般error事件之后会捕捉到close事件
            conn.on('close', function (error) {
                error = error || {message: 'none', stack: 'none'};
                debug(' connet cloesd，message:' + error.message);
            });
            debug('mq connet success');
            return conn.createChannel();
        })
        .then(function (ch) {
            if (!ch) {
                throw ('建立通道失败');
            }
            that._status = CONNECT_STATUS.connected;
            that.channel = ch;
            debug('mq connet success');
            return ch.prefetch(prefetchCount);
        });
};

/**
 * 确认收到方法
 * @param msg 获取到的消息对象
 * @returns {{deliveryTag, multiple}}
 */
Mq.prototype.ack = function (msg) {
    var queue = this;
    return queue.createChannel()
        .then(function () {
            return queue.channel.ack(msg);
        });
};

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
    this.messageCount = 0;
    this.consumerCount = 0;
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
            return Promise.resolve();
        }
        //建立通道
        return queue.createChannel({noAck: false})
            .then(function () {
                return queue.channel
                    .assertQueue(queue.queue, queue.options);
            })
            //绑定异常事件
            .then(function (data) {
                debug('queue：' + queue.queue + ' create success');
                queue.isAlive = true;
                queue.consumerCount = data.consumerCount;
                queue.messageCount = data.messageCount;
                queue.channel.on('error', function (error) {
                    error = error || {message: 'none', stack: 'none'};
                    debug('queue：', queue.queue + 'error，message:' +
                        error.message + ' \nstack:' + error.stack);
                });
                //一般error事件之后会捕捉到close事件
                queue.channel.on('close', function (error) {
                    queue.isAlive = false;
                    queue._status = CONNECT_STATUS.unconnected;
                    error = error || {message: 'none', stack: 'none'};
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
                    return createQueue.call(queue);
                })
                .catch(function () {
                    return queue.createQueue();
                });
        } else {
            queue._status = CONNECT_STATUS.connecting;
            return createQueue.call(queue)
                .catch(function () {
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
            queue.consumerCount = data.consumerCount;
            queue.messageCount = data.messageCount;
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
            }, {noAck: false});
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


module.exports = Queue;