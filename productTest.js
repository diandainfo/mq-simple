var config = {
        host: '192.168.1.101',
        account: 'guest',
        password: 'guest'
    },
    options = {
        queueName: 'test',
        prefetchCount: 1
    },
    Queue = require('./index').Queue,
    i = 0;
var queue = new Queue(config, options);

setInterval(function () {
    i++;
    console.log(i);
    queue.sendToQueue(i);
}, 500);
