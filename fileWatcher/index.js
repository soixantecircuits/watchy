// Modules
var config = require('../config/config.json');
var _ = require('lodash');
var pathHelper = require('path');

// local variables
var lastFile = '';

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

      if (path.indexOf('!sync') < 0) {
        //Add a slight delay to avoid error on get when too fast request are made.
        //See bug https://github.com/joyent/node/issuesfindNameSpace/4863
        //Data is not ready but someone is trying to access to ....

        setTimeout(function() {
          try {
            console.log('Adding: ' + path);
            console.log('Watching: ' + config.watch.path);
            var os = require("os");
            var watchPath = (config.watch.path.charAt(config.watch.path.length - 1) !== '/') ? config.watch.path : config.watch.path.substring(0, config.watch.path.length - 1);
            var relativePath = path.replace(watchPath, 'http://' + module.exports.host + ":" + config.port);

            console.log(relativePath);

            /*var splitedPath = path.split('/');
            var nsp = splitedPath[splitedPath.length - 2];
            nsp = nsp === config.watch.path.split('/').pop() ? '' : nsp;*/
            var nsp = findNameSpace(path);
            var queryNamespace = nsp;
            //console.log(queryNamespace);
            var transporterSocketio = _.where(module.exports.transporter, {
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
              if(module.exports.transporter.length > 0){
                _.each(module.exports.transporter, function(senderIO, index) {
                  senderIO.send(relativePath, 'new-file');
                });
              }
            } else {
              console.log('Sorry we can not send using socket.io, no transport available, check your network\nor your namspace...');
            }

            if (config.transport === 'osc' || config.transport === 'both') {
              var transporterOsc = _.where(module.transporter, {
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
            console.log('Error in adding file: ' + err);
          }
        }, 500);
      } else {
        console.log('Chokidar: File', path, 'should be ignored');
      }
    })
    .on('change', function(path, stats) {
      console.log('Chokidar: File', path, 'has been changed');
      if (stats) {
        console.log(stats);
      }
    })
    .on('unlink', function(path) {
      if (path.indexOf('!sync') < 0) {
        try {
          var relativePath = path.replace(config.watch.path, 'http://' + module.exports.host + ":" + config.port);
          console.log(relativePath);

          var nsp = findNameSpace(path);

          var transporterSocketio = _.where(module.exports.transporter, {
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
            var transporterOsc = _.where(module.exports.transporter, {
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
    .on('addDir', function(path) {
      console.log('Chokidar: Directory', path, 'has been added');
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
      console.info('Raw event info:', event, path, details)
    })
}

module.exports = {
  init: function(host, transporter){
    this.host = host;
    this.transporter = transporter;
    initWatcher();
  }
}