var config = {
        host: '192.168.1.101',
        account: 'guest',
        password: 'guest'
    },
    options = {
        queueName: 'test',
        prefetchCount: 1
    },
    Queue = require('./index').Queue;
var queue = new Queue(config, options);

queue.consume(function (content, message) {
    console.log(content);
    queue.ack(message)
        .catch(function () {
            console.error('ACK错误');
        });
});