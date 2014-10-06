var config = require('./config/config.json'),
    watch = require('watch'),
    io = require('socket.io-client');

var pathes = config.watch.path;
var prevPath;

console.log("Initializing...");

var screen1 = io.connect(config.socket.address + '/screen1');
var screen2 = io.connect(config.socket.address + '/screen2');

screen1.on('connect', function () {
    if(config.watch.path.screen1){
        watchyDoTheWatch(config.watch.path.screen1, screen1);
    }
});
screen2.on('connect', function () {
    if(config.watch.path.screen2){
        watchyDoTheWatch(config.watch.path.screen2, screen2);
    }
});

function watchyDoTheWatch(rootpath, namespace){
    watch.createMonitor(rootpath, function (monitor) {
        monitor.on("created", function (path, stat) {
            if (/^[^\.].*$/.test(path.split("/").pop()) && path !== prevPath) {
                console.log("created, ",path);
                prevPath = path;
                try {
                    namespace.emit('new-image', { src: path });
                    console.log('"new-image" message sent with path: ', path);
                }catch(err){
                  console.log(err)
                }
            }
        });

        monitor.on("changed", function (path, curr, prev) {
            if (/^[^\.].*$/.test(path.split("/").pop()))
                console.log("changed, ",path);
        });

        monitor.on("removed", function (path, stat) {
            if (/^[^\.].*$/.test(path.split("/").pop()))
                console.log("removed, ",path);
        });
    })
}

console.log("...Initialized");