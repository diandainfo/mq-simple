const Queue = require('./lib/queue');
// const Channel = require('./lib/channel');
const Connect = require('./lib/connect');

let conn = new Connect({
    host: '192.168.1.101',
    port: '5672',
    accont: 'guest',
    password: 'guest'
});

let queue = new Queue('test', conn);
let n = 0;

setInterval(function () {
    queue.sendToQueue({
        n: n
    });
    n++;
}, 1000)

// console.log(Buffer.from('1233123') instanceof Buffer);
