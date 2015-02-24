'use strict';
//TODO : add namespace for client mode !

var config = require('./config/config.json'),
  transporter = [],
  _ = require('lodash'),
  util = require('util'),
  initialScanComplete = false,
  mdns = require('mdns'),
  mkdirp = require('mkdirp'),
  ip = require('ip'),
  reconnected = false,
  reconnecting = false,
  currentServiceAddress = '',
  fs = require('fs'),
  namespaces = [],
  host = '',
  connected = false,
  app;

var initTransporter = function() {
  if ((config.transport === 'socket.io' || config.transport === 'both') && config.state === 'server') {
    console.log('Init socket.io server mode...');
    var io = require('socket.io')(app);
    if (config.state === 'server') {
      var ad = mdns.createAdvertisement(mdns.tcp('watchy'), config.port);
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
    transporter.push(socketIO);

  } else if ((config.transport === 'socket.io' || config.transport === 'both') && config.state === 'client') {

    // Could be improved

    initSocketIOClient(config.client.address, config.client.port);

    var handleError = function(error) {
      switch (error.errorCode) {
        case mdns.kDNSServiceErr_Unknown:
          console.warn(error);
          // setTimeout(createAdvertisement, 5000);
          break;
        default:
          // throw error;
          console.log(error);
      }
    };

    try {
      var serviceBrowser = mdns.createBrowser(mdns.tcp(config.servicelookup.name));
      serviceBrowser.on('serviceUp', function(service) {
        console.log("service up: ", service.fullname);
        var serviceHost = service.host.substr(0, service.host.length - 1),
            servicePort = service.port,
            querySearch = {
                host: serviceHost,
                port: servicePort
              };
        
        var exist = _.find(transporter, querySearch);
        //console.log('query:', util.inspect(querySearch,{depth:4}));
        //console.log('exist: ', exist);

        if (exist == undefined) {
          console.log(serviceHost+':'+servicePort+' does not exist, we initiate connection');
          initSocketIOClient(service.host.substr(0, service.host.length - 1), service.port)
          //currentServiceAddress = service.host.substr(0, service.host.length - 1);
        }

      });
      serviceBrowser.on('serviceDown', function(service) {
        console.log("service down: ", service.name);
      });
      serviceBrowser.start();
    } catch (ex) {
      handleError(ex);
    }
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

var initSocketIOClient = function(address, port) {
  console.log('Init socket.io client mode : ', address, port);
  var socket = require('socket.io-client')('http://' + address + ':' + port);
  socket.on('connect', function() {
    socket.emit('binding');
    host = ip.address();
    console.log(host);
    console.log('Connected to socket.io server: ', address, port);
    //TODO Should bind to a specific socket and not a global
    connected = true;
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
      if (!connected || config.multiConnect) {
        console.warn('Trying to reconnect to: ', address, port);
      }
    })
    .on('bind-nsp', function(nsp) {
      if (config.watch.path)
        if (_.contains(namespaces, nsp) === false) {
          mkdirp(config.watch.path + nsp, function(err) {
            if (err) {
              console.log('mkdirp: ' + err);
            }
          });
          namespaces.push(nsp);
      }
      console.log('Binding folder');
      var nspSocket = require('socket.io-client').connect('http://' + address + ':' + port + nsp);
      transporter.push(createSocketTransporter(nsp, nspSocket, address, port));
    });

  namespaces.push('/');
  transporter.push(createSocketTransporter('/', socket, address, port));
}

function createSocketTransporter(name, socket, host, port) {
  console.log("=============================================");
  console.log(socket.io.opts.host);
  console.log(socket.io.opts.port);
  var socketIO = {
    name: name,
    host: host,
    port: port,
    sender: socket,
    send: function(path, action) {
      if (config.debug == true) {
        console.log('Sending', action, 'using', name);
      }
      socket.emit(action, {
        src: path
      });
    }
  };
  return socketIO;
}

var initWatcher = function() {
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
            var watchPath = (config.watch.path.charAt(config.watch.path.length - 1) !== '/') ? config.watch.path : config.watch.path.substring(0, config.watch.path.length - 1);
            var relativePath = path.replace(watchPath, 'http://' + host + ":" + config.port);

            console.log(relativePath);

            /*var splitedPath = path.split('/');
            var nsp = splitedPath[splitedPath.length - 2];
            nsp = nsp === config.watch.path.split('/').pop() ? '' : nsp;*/

            var nsp = path.replace(config.watch.path, "").split('/')[0];
            //check if it is a file (should have an extension, should be improved to handle folder with "." dot)
            nsp = nsp.indexOf('.') >= 0 ? '' : nsp

            var queryNamespace = '/' + nsp;
            console.log(queryNamespace);
            var transporterSocketio = _.where(transporter, {
              name: queryNamespace
            });
            console.log(transporter);
            if (transporterSocketio.length > 0) {
              _.each(transporterSocketio, function(senderIO, index) {
                senderIO.send(relativePath, 'image-saved');
              })
            } else {
              console.log('Sorry we can not send using socket.io, no transport available, check your network\nor your namspace...');
            }

            if (config.transport === 'osc' || config.transport === 'both') {
              var transporterOsc = _.where(transporter, {
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

          var transporterSocketio = _.where(transporter, {
            name: '/' + nsp
          });
          if (transporterSocketio.length > 0) {
            //transporterSocketio[0].send(relativePath, 'image-deleted');
            _.each(transporterSocketio, function(senderIO, index) {
              senderIO.send(relativePath, 'image-deleted');
            })
          } else {
            console.log('Sorry we can not send using OSC, no transport available');
          }
          if (config.transport === 'osc' || config.transport === 'both') {
            var transporterOsc = _.where(transporter, {
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

var initStatiqueServer = function() {

  var staticServer = require('node-static'),
    fileServer = new staticServer.Server(config.watch.path, {
      cache: 7200,
      serverInfo: "watchy/" + host
    });

  app = require('http').createServer(function(request, response) {
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

console.log("Initializing...");

if (fs.existsSync(config.watch.path)) {
  initStatiqueServer();
  initTransporter();
  //TODO add some ready event to tell the watcher to init.
  initWatcher();
  console.log("...Initialized");
  // Output
  var os = require("os");
  host = os.hostname();
  if (os.platform() === 'linux') {
    var child_process = require("child_process");
    child_process.exec("hostname -f", function(err, stdout, stderr) {
      host = stdout.trim();
      //hot and dirty fix
      if (host.indexOf('local') < 0) {
        host += '.local'
      }
    });
  }
  require('dns').resolve('www.google.com', function(err) {
    if (err) {
      console.log('No internet connection, serving from localhost');
      host = '127.0.0.1';
    } else {
      console.log('All fine, we have access to internet');
    }
  });
  console.log("Listening on: " + config.port);
  app.listen(config.port)
    .on('error', function(err) {
      console.log(err);
      process.exit(1);
    });
} else {
  console.log('Sorry, we can\'t watch something that does not exist: ', config.watch.path);
}