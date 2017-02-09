var should = require('should'),
    config = {
        host: '192.168.1.101:5674',
        account: 'guest',
        password: 'guest'
    },
    exchangeConfig = {
        exchange: 'test.exchange',
        type: 'direct',
        options: {
            durable: false
        }
    },
    queueAConfig = {
        options: {
            queueName: 'test-exchange-a',
            prefetchCount: 1,
            durable: false
        },
        extraOptions: {
            source: 'test-exchange',
            pattern: ['test.exchange', 'c'],
            exchangeType: 'direct'
        }
    },
    queueBConfig = {
        options: {
            queueName: 'test-exchange-b',
            prefetchCount: 1,
            durable: false
        },
        extraOptions: {
            source: 'test-exchange',
            pattern: ['b'],
            exchangeType: 'direct'
        }
    },
    Queue = require('../index').Queue,
    Exchange = require('../index').Exchange,
    queueAMsg = 'a',
    queueBMsg = 'b',
    queueCMsg = 'c';

describe('测试Mq相关功能', function () {
    describe('.sendToExchange', function () {
        var exchange = new Exchange(config, exchangeConfig);
        it('应当正确发送消息并获得成功返回值', function (done) {
            exchange.publish('a', queueAMsg)
                .then(function (result) {

                    result.should.equal(true);
                    return exchange.publish('b', queueBMsg);
                })
                .then(function (result) {
                    result.should.equal(true);
                    return exchange.publish('c', queueCMsg);
                })
                .then(function (result) {
                    result.should.equal(true);
                    done();
                })
                .catch(function (error) {
                    done(error);
                })
        })
    });
    describe('.consum', function () {
        var queueA = new Queue(config, queueAConfig.options, queueAConfig.extraOptions);
        var queueB = new Queue(config, queueBConfig.options, queueBConfig.extraOptions);
        this.timeout(2000);
        it('应当可以正确消费且获取正确的消息A和C', function (done) {
            let times = 0;
            queueA.consume(function (content, message) {
                    times++;
                    queueA.ack(message)
                        .then(function () {
                            if (content != queueAMsg & content != queueBMsg) {
                                done('收到的消息错误，收到的消息为：' + data);
                            }
                            if (times == 2) {
                                done();
                            }
                        })
                        .catch(function (error) {
                            done(error, 'ACK错误')
                        });
                })
                .catch(function (error) {
                    done(error, '建立消费者错误');
                })
        });
        it('应当可以正确消费且获取正确的消息B', function (done) {
            queueB.consume(function (content, message) {
                    queueB.ack(message)
                        .then(function () {
                            if (content == queueBMsg) {
                                done();
                            }
                        })
                        .catch(function (error) {
                            done(error, 'ACK错误')
                        })
                })
                .catch(function (error) {
                    done(error, '建立消费者错误');
                })
        })
    })
});