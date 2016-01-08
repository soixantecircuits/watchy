'use strict';
//TODO : add namespace for client mode !

var config = require('./config/config.json'),
  _ = require('lodash'),
  util = require('util'),
  mdns = require('mdns'),
  mkdirp = require('mkdirp'),
  clc = require('cli-color'),
  express = require('express'),
  ip = require('ip'),
  fs = require('fs'),
  pathHelper = require('path'),
  mediainfo = require('mediainfo-q'),
  currentServiceAddress = '',
  serverHttp,
  transporter = [],
  namespaces = [],
  host = '',
  connected = false,
  lastFile = '',
  app;

process.title = 'watchy-' + config.servicelookup.name;

var findNameSpace = function(path) {
  var directoryName = pathHelper.dirname(path);
  var nsp = directoryName.replace(config.watch.path, '');
  if (nsp.length > 0) {
    nsp = (nsp[0] === '/') ? nsp : '/' + nsp;
  } else {
    nsp = '/';
  }
  return nsp;
};

var initTransporter = function() {
  if ((config.transport === 'socket.io' || config.transport === 'both') && config.state === 'server') {
    console.log('Init socket.io server mode...');
    var io = require('socket.io')(serverHttp);
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
    if (config.client) {
      initSocketIOClient(config.client.address, config.client.port);
    }
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
        console.log(clc.blue('Service up: ') + service.fullname);
        var serviceHost = service.host.substr(0, service.host.length - 1),
          servicePort = service.port,
          querySearch = {
            host: serviceHost,
            port: servicePort
          };

        var exist = _.find(transporter, querySearch);
        /*console.log('query:', util.inspect(querySearch,{depth:4}));
        console.log('exist: ', exist);
        console.log('transporter:', transporter);*/

        if (exist === undefined) {
          console.log(serviceHost + ':' + servicePort + ' does not exist, we initiate connection');
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
    //console.log(host);
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
          console.log('Binding folder');
          var nspSocket = require('socket.io-client').connect('http://' + address + ':' + port + nsp);
          transporter.push(createSocketTransporter(nsp, nspSocket, address, port));
      }
    });

  namespaces.push('/');
  transporter.push(createSocketTransporter('/', socket, address, port));
}

function createSocketTransporter(name, socket, host, port) {
  console.log("=============================================");
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
var checkIntegrity = function(path, cb){
  
/*
  mediainfo(path, 
    function(err, data){
      if(err) {
       console.log(err) 
      } else{
        console.log(data)
        if(data[0].duration.length > 0){
          cb()  
        }
        
      }
     
    })
  
*/
  mediainfo(path)
    .then(function (res) {
      //console.log(res)
        if(res[0].duration && res[0].duration.length > 0){
          cb()  
        }
    }).catch(function (err) {
      console.error(err)
    })
}
var send = function(path){
        setTimeout(function() {
          try {
            //console.log(path);
            //console.log(config.watch.path);
            var os = require("os");
            var watchPath = (config.watch.path.charAt(config.watch.path.length - 1) !== '/') ? config.watch.path : config.watch.path.substring(0, config.watch.path.length - 1);
            var relativePath = path.replace(watchPath, 'http://' + host + ":" + config.port);

            console.log('send ' + relativePath);

            /*var splitedPath = path.split('/');
            var nsp = splitedPath[splitedPath.length - 2];
            nsp = nsp === config.watch.path.split('/').pop() ? '' : nsp;*/
            var nsp = findNameSpace(path);
            var queryNamespace = nsp;
            //console.log(queryNamespace);
            var transporterSocketio = _.where(transporter, {
              name: queryNamespace
            });
            //console.log(transporter);
            if (transporterSocketio.length > 0) {
              _.each(transporterSocketio, function(senderIO, index) {
                // senderIO.send(relativePath, 'image-saved');
                //other app should migrate to new-file
                senderIO.send(relativePath, 'new-file');
                lastFile = path;
              })
            } else if (config.state === 'server') {
              if(transporter.length > 0){
                _.each(transporter, function(senderIO, index) {
                  senderIO.send(relativePath, 'new-file');
                });
              }
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

}

var initWatcher = function() {
  var chokidar = require('chokidar');

  var watcher = chokidar.watch(config.watch.path, {
    ignored: /[\/\\]\./,
    ignoreInitial: config.ignoreInitial,
    persistent: true
  });

  watcher
    .on('add', function(path) {
      if(lastFile.length && lastFile == path){
        return;
      }

      if (path.indexOf('!sync') < 0 && path.indexOf('mp4') < 0) {
        //Add a slight delay to avoid error on get when too fast request are made.
        //See bug https://github.com/joyent/node/issues/4863
        //Data is not ready but someone is trying to access to ....
        send(path)
      } else if ( path.indexOf('mp4') ) {
        checkIntegrity(path, function(){
          send(path)
        })
        console.log('Chokidar: mp4 ignored at creation : ', path);
      } else {
        console.log('Chokidar: File ignored: ', path);
      }

    })
    .on('addDir', function(path) {
      console.log('Chokidar: Directory added: ', path);
    })
    .on('change', function(path, stats) {
      console.log('Chokidar: File changed: ', path);
      if (stats) {
        // console.log(stats);
        if (path.indexOf('mp4')){
          checkIntegrity(path, function(){
            send(path)
          })
        }
      }
    })
    .on('unlink', function(path) {
      if (path.indexOf('!sync') < 0) {
        try {
          var relativePath = path.replace(config.watch.path, 'http://' + host + ":" + config.port);
          console.log(relativePath);

          /*var splitedPath = path.split('/');
          var nsp = splitedPath[splitedPath.length - 2];
          nsp = nsp === config.watch.path.split('/').pop() ? '' : nsp;*/
          var nsp = findNameSpace(path);

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
        console.log('File', path, 'should be ignored');
      }
      console.log('File', path, 'has been removed');
    })
    .on('unlinkDir', function(path) {
      console.log('Chokidar: Directory', path, 'has been removed');
    })
    .on('error', function(error) {
      console.error('Chokidar: Error happened', error);
    })
    .on('ready', function() {
      console.info('Chokidar: Initial scan complete. Ready for changes.');
    })
    .on('raw', function(event, path, details) {
      //console.info('Raw event info:', event, path, details)
    })
}

var initStatiqueServer = function() {
  app = express();
  var options = {
    dotfiles: 'ignore',
    etag: false,
    extensions: ['htm', 'html'],
    index: false,
    maxAge: '1d',
    redirect: false,
    setHeaders: function(res, path, stat) {
      res.set('x-timestamp', Date.now())
      res.set('', Date.now())
    }
  };
  app.use(express.static(config.watch.path, options));
  serverHttp = require('http').Server(app);
}

console.log(clc.blue("Initializing..."));

if (fs.existsSync(config.watch.path)) {
  initStatiqueServer();
  initTransporter();
  //TODO add some ready event to tell the watcher to init.
  initWatcher();
  console.log(clc.green("...Initialized"));
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
      console.log(clc.red('No internet connection, serving from localhost'));
      host = '127.0.0.1';
    }
  });
  console.log('Watching: ' + config.watch.path);
  console.log(clc.blue('Listening on: ') + clc.green('http://' +ip.address()+':'+config.port));
  serverHttp.listen(config.port)
    .on('error', function(err) {
      console.log(err);
      process.exit(1);
    });
} else {
  console.log(clc.red('Sorry, we can\'t watch something that does not exist: '+ config.watch.path));
}
