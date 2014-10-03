var config = require('./config/config.json'),
    watch = require('watch'),
    io = require('socket.io-client')('http://localhost:8010');

var pathes = config.watch.path;
var prevPath;

console.log("Initializing...");

// var socket = io.on('connection', function (socket) {
//     // if(pathes instanceof Array){
//     //     for (var i = pathes.length - 1; i >= 0; i--) {
//     //         watchyDoTheWatch(pathes[i], socket);
//     //     };
//     // } else {
//     //     watchyDoTheWatch(pathes, socket);
//     // }
// });

var screen1 = io.connect('http://localhost:8010/screen1');
var screen2 = io.connect('http://localhost:8010/screen2');

screen1.on('connection', function (socket) {
    watchyDoTheWatch(config.path.screen1, screen1);
});
screen2.on('connection', function (socket) {
    watchyDoTheWatch(config.path.screen2, screen2);
});

function watchyDoTheWatch(rootpath, socket, namespace){
    watch.createMonitor(rootpath, function (monitor) {
        monitor.on("created", function (path, stat) {
            if (/^[^\.].*$/.test(path.split("/").pop()) && path !== prevPath) {
                console.log("created, ",path);
                prevPath = path;
                try {
                    namespace.broadcast.emit('new-image', { src: path });
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

process.on('uncaughtException', function(err) {
  console.log(err);
});