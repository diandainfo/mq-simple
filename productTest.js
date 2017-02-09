var config = {
        host: '192.168.1.101:5674',
        account: 'guest',
        password: 'guest'
    },
    options = {
        queueName: 'test-queue',
        prefetchCount: 1
    },
    Queue = require('./index').Queue,
    i = 0;
var queue = new Queue(config, options);

setInterval(function () {
    i++;
    console.log(i);
    queue.sendToQueue(i)
        .then(function(e) {
            console.log(e);
        })
        .catch(function(e) {
            console.log(e);
        })
}, 500);
