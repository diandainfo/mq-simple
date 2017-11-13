const Queue = require('./lib/queue');
const Connect = require('./lib/connect');

let conn = new Connect({
    host: '192.168.1.101',
    port: '5672',
    accont: 'guest',
    password: 'guest'
});

let queue = new Queue('test', conn);
let n = 0;

queue.consume(function (msg) {
        console.log(n + '------', msg.data);
        n++;
        setTimeout(() => {
            queue.ack(msg);
        }, 1000);
    })
    .catch((error) => {
        console.log(error);
    })

// console.log(Buffer.from('1233123') instanceof Buffer);