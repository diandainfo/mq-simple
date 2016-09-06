var Queue = require('./queue'),
    queueSetsConfig = require('./../../config/mqConfig.json'),
    queueSets;

/**
 * 根据配置文件生成相应的队列实例
 * 配置文件内容：
 * {
 *      vHost:"mq中vHost名称",
 *      queues: "此vHost下的队列"
 *      [
 *          {
 *              name:"代码调用的对象",
 *              queue:"mq中队列名"
 *          }
 *      ]
 *
 * }
 */
queueSets = (function (configs) {
    var i,
        j,
        vHost,
        queue,
        queues,
        queueSets = {};
    if (!Array.isArray(configs)) {
        configs = [configs];
    }
    for (i = 0; i < configs.length; i++) {
        vHost = configs[i].vHost;
        queues = configs[i].queues;
        for (j = 0; j < queues.length; j++) {
            queue = queues[j];
            queueSets[queue.name] = new Queue(queue.queue, {
                vHost: vHost,
                options: queue.options
            });
            queueSets[queue.name].createQueue();
        }
    }
    return queueSets;
})(queueSetsConfig);

module.exports = queueSets;