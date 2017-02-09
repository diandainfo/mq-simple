# mq-simple

# 注意：队列，交换需要先建好，本module不会建立队列

#安装
~~~ shell
    npm install mq-simple --save
~~~
#使用
~~~javascript
// mq配置
var mqConfig={
    host: '192.168.1.101',
    account: 'guest',
    password: 'guest'
};

// 配置选项
var options={
    //队列名称
    queueName: 'test-test-test'
};

// 连接队列
var queue = new Queue(mqConfig, options);

// 发送消息
queue.sendToQueue('这是一个消息');

// 消费消息
queue.consume(function(data,message){
    console.log(data);//打印出'这是一个消息';
    queue.ack(message);
})
~~~