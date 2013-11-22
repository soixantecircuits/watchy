var config = require('./config/config.json'),
    watch = require('watch'),
    io = require('socket.io').listen(config.socketIO.port),
    osc = require('node-osc'),
    socketConnections = [],
    _ = require('lodash'),
    OSCclient = new osc.Client(config.osc.address, config.osc.port);

console.log("Initializing...");

io.sockets.on('connection', function (socket) {
  socket.on('my other event', function (data) {
    console.log(data);
  });
  socketConnections.push(socket);
});

var watch = require('watch')
  watch.createMonitor(config.watch.path, function (monitor) {
    
    monitor.on("created", function (path, stat) {
      if (/^[^\.].*$/.test(path.split("/").pop())) {
        try {
          console.log(path);
          _.each(socketConnections,function(socket){
            var fs = require('fs');
            var destination = config.watch.destination+path.split("/").pop();

            //fs.createReadStream(path).pipe(fs.createWriteStream(destination));
            //socket.emit('new-image', { src: destination.split("/").pop() });
            socket.emit('new-image', { src: path });
          });
          OSCclient.send('/new-image', path);
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

console.log("...Initialized");