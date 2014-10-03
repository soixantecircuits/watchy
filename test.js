var config = "/home/hugo/sources/python/pyying/snaps",
    watch = require('watch');

watch.createMonitor(config, function (monitor) {
    monitor.on("created", function (path, stat) {
        console.log("created", path);
    });
});