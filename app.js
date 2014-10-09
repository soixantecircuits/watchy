'use strict';

var config = require('./config/config.json'),
  watch = require('watch'),
  transporter = [],
  OSCclient = {},
  socketConnections = [],
  _ = require('lodash'),
  watch = require('watch');

var initTransporter = function() {
  if (config.transport === 'socket.io' || config.transport === 'both') {
    io = require('socket.io').listen(config.socketIO.port);
    io.sockets.on('connection', function(socket) {
      socket.on('hello', function(data) {
        if (config.debug == true) {
          console.log('Browser connected');
          console.log(data);
        }
      });
      socketConnections.push(socket);
      transporter.push({
        name: 'socket.io',
        sender: io,
        send: function(path, action) {
          if (socketConnections.length < 0) {
            console.log('No socket open');
          } else {
            if (config.debug == true) {
              console.log('Sending '+action+' using osc');
            }
            _.each(socketConnections, function(socket) {
              socket.emit(action, {
                src: path
              });
            });
          }
        }
      });
    });
  }



  if (config.transport === 'osc' || config.transport === 'both') {
    var osc = require('node-osc'),
      OSCclient = new osc.Client(config.osc.address, config.osc.port);
    transporter.push({
      name: 'osc',
      sender: OSCclient,
      send: function(path, action) {
        if (config.debug == true) {
          console.log('Sending '+action+' using osc');
        }
        OSCclient.send(action, path);
      }
    });
  }

};

var initWatcher = function() {
  watch.createMonitor(config.watch.path, function(monitor) {

    monitor.on("created", function(path, stat) {
      if (/^[^\.].*$/.test(path.split("/").pop())) {
        try {
          console.log(path);
          _.each(transporter, function(transporterElement) {
            transporterElement.send(path, '/new-image');
          });
        } catch (err) {
          console.log(err);
        }
      }
    });

    monitor.on("changed", function(path, curr, prev) {
      if (/^[^\.].*$/.test(path.split("/").pop()))
        console.log("changed, ", path);
    });

    monitor.on("removed", function(path, stat) {
      if (/^[^\.].*$/.test(path.split("/").pop()))
        console.log("removed, ", path);
    });

  });
}

console.log("Initializing...");

initTransporter();

//TODO add some ready event to tell the watcher to init.
initWatcher();

console.log("...Initialized");
//WHY ?
process.on('uncaughtException', function(err) {
  console.log(err);
});