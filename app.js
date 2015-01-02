'use strict';

var config = require('./config/config.json'),
  transporter = [],
  _ = require('lodash'),
  initialScanComplete = false;

var initTransporter = function() {
  if (config.transport === 'socket.io' || config.transport === 'both') {
    var io = require('socket.io').listen(config.socketIO.port);
    var socketIO = {
      name: 'socket.io',
      sender: io,
      socketConnections: [],
      send: function(path, action) {
        if (this.socketConnections.length < 0) {
          console.log('No socket open');
        } else {
          if (config.debug == true) {
            console.log('Sending ' + action + ' using osc');
          }
          _.each(this.socketConnections, function(socket) {
            socket.emit(action, {
              src: path
            });
          });
        }
      }
    };
    socketIO.sender.sockets.on('connection', function(socket) {
      socket.on('hello', function(data) {
        if (config.debug == true) {
          console.log('Browser connected');
          console.log(data);
        }
      });
      socketIO.socketConnections.push(socket);
    });
    transporter.push(socketIO);
  }

  if (config.transport === 'osc' || config.transport === 'both') {
    var osc = require('node-osc'),
      OSCclient = new osc.Client(config.osc.address, config.osc.port),
      OSCSender = {
        name: 'osc',
        sender: OSCclient,
        send: function(path, action) {
          if (config.debug == true) {
            console.log('Sending ' + action + ' using osc');
          }
          this.sender.send(action, path);
        }
      }
    transporter.push(OSCSender);
  }

};

var initWatcher = function() {
  var chokidar = require('chokidar');

  var watcher = chokidar.watch(config.watch.path, {
    ignored: /[\/\\]\./,
    persistent: true
  });

  watcher
    .on('add', function(path) {
      
      if(initialScanComplete){
        try {
          console.log(path);
          _.each(transporter, function(transporterElement) {
            transporterElement.send(path, '/new-image');
          });
        } catch (err) {
          console.log(err);
        }
      } else {
        console.log('File', path, 'was here');
      }
    })
    .on('addDir', function(path) {
      console.log('Directory', path, 'has been added');
    })
    .on('change', function(path) {
      console.log('File', path, 'has been changed');
    })
    .on('unlink', function(path) {
      console.log('File', path, 'has been removed');
    })
    .on('unlinkDir', function(path) {
      console.log('Directory', path, 'has been removed');
    })
    .on('error', function(error) {
      console.error('Error happened', error);
    })
    .on('ready', function() {
      console.info('Initial scan complete. Ready for changes.');
      initialScanComplete = true;
    })
    .on('raw', function(event, path, details) {
      console.info('Raw event info:', event, path, details)
    })
}

var initStatiqueServer = function() {
  var Statique = require("statique"),
    Http = require('http');

  // Create *Le Statique* server
  var server = new Statique({
    root: config.watch.path,
    cache: 36000
  }).setRoutes({
    "/": "/html/index.html"
  });

  // Create server
  Http.createServer(server.serve).listen(8000);

  // Output
  console.log("Listening on 8000.");
}

console.log("Initializing...");

initTransporter();

//TODO add some ready event to tell the watcher to init.
initWatcher();

initStatiqueServer();

console.log("...Initialized");
//WHY ?
process.on('uncaughtException', function(err) {
  console.log(err);
});