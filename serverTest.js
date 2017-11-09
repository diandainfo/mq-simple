var config = {
        host: '192.168.1.101:5674',
        account: 'guest',
        password: 'guest'
    },
    options = {
        queueName: 'test-queue',
        prefetchCount: 10
    },
    Queue = require('./index').Queue,
    Promise = require('bluebird');
var queue = new Queue(config, options);

queue.consume(function (content, message) {
    Promise.resolve()
        .then(function(){
            console.log(content);
            queue.ack(message)
                .catch(function (error) {
                    console.error('ACK错误');
                });
        });

});
setInterval(function() {
    console.log('queue._status:', queue._status)
}, 1000);