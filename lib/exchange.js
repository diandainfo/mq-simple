'use strict'

/**
 * @author WXP
 * @description 交换相关
 */

var util = require('util');
var Promise = require('bluebird');
var debug = require('debug')('mq-simple');
var Mq = require('./mq');
var CONNECT_STATUS = Mq.CONNECT_STATUS;
/**
 * 交换
 * @param config 数据库配置
 * {
 *      host:地址
 *      account:账号
 *      password:密码
 *
 * }
 * @param options 配置参数
 * {
 *      exchangeName:交换名
 *      type: 类型
 *      vHost:虚拟地址
 *      prefetchCount:单次最大接受长度 默认为0 设置为1时 1条消息acknowledge第二条消息才会收到
 *      rabbitmq其它配置参数
 * }
 * @constructor
 */
var Exchange = function (config, options) {
    //获取Mq的配置
    Mq.call(this, config, options);
    this.exchange = options.exchange;
    this.exchangeType = options.type,
        this.consumers = [];
    this.isAlive = false;
    this.options = options.options || {};
};

//使Exchange继承Mq
util.inherits(Exchange, Mq);

/**
 * 创建交换
 * @returns {*}
 */
Exchange.prototype.createExchange = (function () {
    function createExchange() {
        var exchange = this;
        if (exchange.isAlive) {
            return Promise.resolve(exchange);
        }
        //建立通道
        return exchange.createChannel({
                noAck: false
            })
            // 检查交换是否存在
            .then(function () {
                return exchange.channel.checkExchange(exchange.exchange)
                    .then(function (data) {
                        if (!data) {
                            exchange.isAlive = false;
                            throw (exchange.exchange + '队列不存在');
                        }
                        return Promise.resolve(exchange);
                    })
            })
            //绑定异常事件
            .then(function () {
                debug('exchange：' + exchange.exchange + ' create success');
                exchange.isAlive = true;
                exchange.channel.on('error', function (error) {
                    error = error || {
                        message: 'none',
                        stack: 'none'
                    };
                    debug('exchange：', exchange.exchange + 'error，message:' +
                        error.message + ' \nstack:' + error.stack);
                });
                //一般error事件之后会捕捉到close事件
                exchange.channel.on('close', function (error) {
                    exchange.isAlive = false;
                    exchange._status = CONNECT_STATUS.unconnected;
                    error = error || {
                        message: 'none',
                        stack: 'none'
                    };
                    debug('exchange：', exchange.exchange + 'error，message:' +
                        error.message + ' \nstack:' + error.stack);
                    exchange.createExchange();
                });
                return Promise.resolve(exchange);
            })
            //绑定消费者
            .then(function () {
                return Promise.each(exchange.consumers, function (par) {
                    exchange.consume(par);
                });
            })
            //完成
            .then(function () {
                return Promise.resolve(exchange);
            })
            .catch(function (erorr) {
                debug('connect failed ：' + erorr.message +
                    ' \nstack:' + erorr.stack);
                return Promise.reject(erorr);
            });
    }

    return function () {
        var exchange = this;
        if (exchange._status == CONNECT_STATUS.connected) {
            return Promise.resolve(exchange);
        }
        if (exchange._status == CONNECT_STATUS.connecting) {
            return Promise
                .delay(1000)
                .then(function () {
                    console.log('mq-connect:exchange-' + exchange.exchange + ': waiting....');
                    return exchange.createExchange();
                })
                .catch(function () {
                    return exchange.createExchange();
                });
        } else {
            exchange._status = CONNECT_STATUS.connecting;
            return createExchange.call(exchange)
                .catch(function () {
                    console.log('mq-connect:exchange-' + exchange.exchange + ': failed');
                    exchange._status = CONNECT_STATUS.unconnected;
                    return exchange.createExchange();
                });
        }
    };
})();

/**
 * 发送消息
 * @param message
 * @returns {Promise|*}
 */
Exchange.prototype.publish = function (routingKey, message, options) {
    var exchange = this;
    if (typeof message == 'object') {
        message = JSON.stringify(message);
    }
    message = new Buffer(message + '', 'utf8');
    return exchange.createExchange()
        .then(function () {
            return exchange.channel.publish(exchange.exchange, routingKey, message, options);
        });
};


/**
 * 重新连接
 * @returns {*}
 */
Exchange.prototype.reconnect = function () {
    var exchange = this;
    if (exchange._status == CONNECT_STATUS.connected) {
        exchange._status = CONNECT_STATUS.unconnected;
    }
    return exchange.createExchange();
};


module.exports = Exchange;