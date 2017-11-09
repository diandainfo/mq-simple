/* eslint-disable no-unused-vars */
var should = require('should');
var config = {
    host: '192.168.1.101:5673',
    account: 'guest',
    password: 'guest'
};
var options = {
    queueName: 'test-queue',
    prefetchCount: 1
};
var Queue = require('../index').Queue;
var data = 123;

describe('测试Mq相关功能', function () {
    describe('.sendToQueue', function () {
        var queue = new Queue(config, options);
        it('应当正确发送消息并获得成功返回值', function (done) {
            queue.sendToQueue(data)
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
        var queue = new Queue(config, options);
        this.timeout(1000);
        it('应当可以正确消费且获取正确的消息', function (done) {
            queue.consume(function (content, message) {
                    if (content == data) {
                        done();
                    }
                    queue.ack(message)
                        .catch(function (error) {
                            done(error, 'ACK错误')
                        });
                })
                .catch(function (error) {
                    done(error, '建立消费者错误');
                })
        })
    })
});