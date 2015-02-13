'use strict';
//TODO : add namespace for client mode !

var config = require('./config/config.json'),
  _ = require('lodash'),
  util = require('util'),
  initialScanComplete = false,
  mdns = require('mdns'),
  mkdirp = require('mkdirp'),
  reconnected = false,
  reconnecting = false,
  currentServiceAddress = '',
  fs = require('fs'),
  host = '';

var watchy = {};

watchy.app;
watchy.transporter = [];
watchy.namespaces = [];

watchy.initTransporter = function() {
  if ((config.transport === 'socket.io' || config.transport === 'both') && config.state === 'server') {
    console.log('Init socket.io server mode...');
    var io = require('socket.io')(watchy.app);
    if (config.state === 'server') {
      // advertise a http server on port 4321
      var ad = mdns.createAdvertisement(mdns.tcp('socket-io'), config.port);
      ad.start();
    }
    //var io = require('socket.io').listen(config.socketIO.port);
    var socketIO = {
      name: 'socket.io',
      sender: io,
      socketConnections: [],
      send: function(path, action) {
        if (this.socketConnections.length < 0) {
          console.log('No socket open');
        } else {
          if (config.debug == true) {
            console.log('Sending ' + action + ' using socket.io');
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
          console.log('client connected');
          console.log(data);
        }
      });
      socketIO.socketConnections.push(socket);
    });
    watchy.transporter.push(socketIO);

  } else if ((config.transport === 'socket.io' || config.transport === 'both') && config.state === 'client') {

    // Could be improved
    watchy.initSocketIOClient(config.client.address, config.client.port);

    // watch all http servers
    var service = mdns.createBrowser(mdns.tcp(config.servicelookup.name));
    service.on('serviceUp', function(service) {
      console.log("service up: ", service.fullname);
      //Should be cleaned to avoid creating useless
      if (currentServiceAddress !== service.host.substr(0, service.host.length - 1) && config.client.address, config.client.port != service.host) {
        watchy.initSocketIOClient(service.host.substr(0, service.host.length - 1), service.port)
        currentServiceAddress = service.host.substr(0, service.host.length - 1);
      }

    });
    service.on('serviceDown', function(service) {
      console.log("service down: ", service.fullname);
    });
    service.on('error', function(err) {
      console.log(err);
    })
    service.start();
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
    watchy.transporter.push(OSCSender);
  }
};

watchy.initSocketIOClient = function(address, port) {
  console.log('Init socket.io client mode : ', address, port);
  var socket = require('socket.io-client')('http://' + address + ':' + port);
  socket
  .on('connect', function() {
    socket.emit('binding');
    console.log('connected to socket.io server: ', address, port);
  })
  .on('disconnect', function() {
    console.log('We\'ve been disconnected');
  })
  .on('error', function() {
    console.log('error while connecting');
  })
  .on('reconnect', function(nbtry) {
    console.log('Successfull reconnect after ' + nbtry + ' trying.');
  })
  .on('reconnecting', function(nbtry) {
     console.log('Trying to reconnect to: ',address, port);
  })
  .on('bind-nsp', function(nsp) {
    if (config.watch.path)
      if (_.contains(watchy.namespaces, nsp) === false) {
        mkdirp(config.watch.path + nsp, function(err) {
          if (err) {
            console.log('mkdirp: ' + err);
          }
        });
        watchy.namespaces.push(nsp);
      }
    var nspSocket = require('socket.io-client').connect('http://' + address + ':' + port + nsp);
    watchy.transporter.push(watchy.createSocketTransporter(nsp, nspSocket));
  });

  watchy.namespaces.push('/');
  watchy.transporter.push(watchy.createSocketTransporter('/', socket));
}

watchy.createSocketTransporter = function(name, socket) {
  var socketIO = {
    name: name,
    sender: socket,
    send: function(path, action) {
      if (config.debug == true) {
        console.log('Sending', action, 'using', name);
      }
      socket.emit(action, {
        src: path
      });
      return true;
    }
  };
  return socketIO;
}

watchy.initWatcher = function() {
  var chokidar = require('chokidar');

  var watcher = chokidar.watch(config.watch.path, {
    ignored: /[\/\\]\./,
    persistent: true
  });

  watcher
    .on('add', function(path) {

      if (initialScanComplete) {
        //Add a slight delay to avoid error on get when too fast request are made.
        //See bug https://github.com/joyent/node/issues/4863
        //Data is not ready but someone is trying to access to ....

        setTimeout(function() {
          try {
            console.log(path);
            console.log(config.watch.path);
            var os = require("os");
            var relativePath = path.replace(config.watch.path, 'http://' + host + ":" + config.port);

            console.log(relativePath);

            var splitedPath = path.split('/');
            var nsp = splitedPath[splitedPath.length - 2];
            nsp = nsp === config.watch.path.split('/').pop() ? '' : nsp;


            var transporterSocketio = _.where(watchy.transporter, {
              name: '/' + nsp
            });

            if (transporterSocketio.length > 0) {
              _.each(transporterSocketio, function(senderIO, index){
                senderIO.send(relativePath, 'image-saved');
              })
            } else {
              console.log('Sorry we can not send using socket.io, no transport available, check your network\nor your namspace...');
            }

            if (config.transport === 'osc' || config.transport === 'both') {
              var transporterOsc = _.where(watchy.transporter, {
                name: 'osc'
              });
              if (transporterOsc.length > 0) {
                transporterOsc[0].send(relativePath, 'new-file');
                transporterOsc[0].send(relativePath, 'new-image'); // legacy until june 2015
              } else {
                console.log('Sorry we can not send using OSC, no transport available');
              }
            }
          } catch (err) {
            console.log(err);
          }
        }, 500);
      } else {
        console.log('Chokidar - File', path, 'was here... not sending');
      }
    })
    .on('addDir', function(path) {
      console.log('Chokidar - Directory', path, 'has been added');
    })
    .on('change', function(path, stats) {
      console.log('Chokidar - File', path, 'has been changed');
      if (stats) {
        console.log(stats);
      }
    })
    .on('unlink', function(path) {
      if (initialScanComplete) {
        try {
          var relativePath = path.replace(config.watch.path, 'http://' + host + ":" + config.port);
          console.log(relativePath);

          var splitedPath = path.split('/');
          var nsp = splitedPath[splitedPath.length - 2];
          nsp = nsp === config.watch.path.split('/').pop() ? '' : nsp;

          var transporterSocketio = _.where(watchy.transporter, {
            name: '/' + nsp
          });
          if (transporterSocketio.length > 0) {
            //transporterSocketio[0].send(relativePath, 'image-deleted');
            _.each(transporterSocketio, function(senderIO, index){
                senderIO.send(relativePath, 'image-deleted');
              })
          } else {
            console.log('Sorry we can not send using OSC, no transport available');
          }
          if (config.transport === 'osc' || config.transport === 'both') {
            var transporterOsc = _.where(watchy.transporter, {
              name: 'osc'
            });
            if (transporterOsc.length > 0) {
              transporterOsc[0].send(relativePath, 'image-deleted');
            } else {
              console.log('Sorry we can not send using OSC, no transport available');
            }

          }
        } catch (err) {
          console.log(err);
        }
      } else {
        console.log('File', path, 'was here');
      }
      console.log('File', path, 'has been removed');
    })
    .on('unlinkDir', function(path) {
      console.log('Chokidar - Directory', path, 'has been removed');
    })
    .on('error', function(error) {
      console.error('Chokidar - Error happened', error);
    })
    .on('ready', function() {
      console.info('Chokidar - Initial scan complete. Ready for changes.');
      initialScanComplete = true;
    })
    .on('raw', function(event, path, details) {
      //console.info('Raw event info:', event, path, details)
    })
}

watchy.initStatiqueServer = function() {

  var staticServer = require('node-static'),
    fileServer = new staticServer.Server(config.watch.path, {
      cache: 7200,
      serverInfo: "watchy/" + host
    });

  watchy.app = require('http').createServer(function(request, response) {
    request.addListener('end', function() {
      fileServer.serve(request, response).addListener('error', function(err) {
        util.error("Error serving " + request.url + " - " + err.message);
        response.end();
      });
    }).resume();
  });

  /* Does not provide meaning full message when error occur
  var Statique = require("statique");

  // Create *Le Statique* server
  var server = new Statique({
    root: config.watch.path
  }).setRoutes({
    "/": "/html/index.html"
  });

  // Create server
  app = require('http').createServer(server.serve);*/
}

module.exports = watchy;