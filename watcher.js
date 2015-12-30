'use strict'

var findNameSpace = function (path) {
  var directoryName = pathHelper.dirname(path)
  var nsp = directoryName.replace(config.watch.path, '')
  if (nsp.length > 0) {
    nsp = (nsp[0] === '/') ? nsp : '/' + nsp
  } else {
    nsp = '/'
  }
  return nsp
}

const initWatcher = function (config, transporter) {
  var chokidar = require('chokidar')
  var watcher = chokidar.watch(config.watch.path, {
    ignored: /[\/\\]\./,
    ignoreInitial: config.ignoreInitial,
    persistent: true
  })

  watcher
    .on('add', function (path) {
      if (lastFile.length && lastFile == path) {
        return
      }

      if (path.indexOf('!sync') < 0) {
        // Add a slight delay to avoid error on get when too fast request are made.
        // See bug https://github.com/joyent/node/issues/4863
        // Data is not ready but someone is trying to access to ....

        setTimeout(function () {
          try {
            var os = require('os')
            var watchPath = (config.watch.path.charAt(config.watch.path.length - 1) !== '/') ? config.watch.path : config.watch.path.substring(0, config.watch.path.length - 1)
            var relativePath = path.replace(watchPath, 'http://' + host + ':' + config.port)
            console.log(relativePath)
            var nsp = findNameSpace(path)
            var queryNamespace = nsp
            var transporterSocketio = _.where(transporter, {
              name: queryNamespace
            })
            if (transporterSocketio.length > 0) {
              _.each(transporterSocketio, function (senderIO, index) {
                senderIO.send(relativePath, 'new-file')
                lastFile = path
              })
            } else if (config.state === 'server') {
              if (transporter.length > 0) {
                _.each(transporter, function (senderIO, index) {
                  senderIO.send(relativePath, 'new-file')
                })
              }
            } else {
              console.log('Sorry we can not send using socket.io, no transport available, check your network\nor your namspace...')
            }

            if (config.transport === 'osc' || config.transport === 'both') {
              var transporterOsc = _.where(transporter, {
                name: 'osc'
              })
              if (transporterOsc.length > 0) {
                transporterOsc[0].send(relativePath, 'new-file')
                transporterOsc[0].send(relativePath, 'new-image') // legacy until june 2015
              } else {
                console.log('Sorry we can not send using OSC, no transport available')
              }
            }
          } catch (err) {
            console.log(err)
          }
        }, 500)
      } else {
        console.log('Chokidar: File', path, 'should be ignored')
      }
    })
    .on('addDir', function (path) {
      console.log('Chokidar: Directory', path, 'has been added')
    })
    .on('change', function (path, stats) {
      console.log('Chokidar: File', path, 'has been changed')
      if (stats) {
        console.log(stats)
      }
    })
    .on('unlink', function (path) {
      if (path.indexOf('!sync') < 0) {
        try {
          var relativePath = path.replace(config.watch.path, 'http://' + host + ':' + config.port)
          console.log(relativePath)
          var nsp = findNameSpace(path)

          var transporterSocketio = _.where(transporter, {
            name: '/' + nsp
          })
          if (transporterSocketio.length > 0) {
            _.each(transporterSocketio, function (senderIO, index) {
              senderIO.send(relativePath, 'image-deleted')
            })
          } else {
            console.log('Sorry we can not send using OSC, no transport available')
          }
          if (config.transport === 'osc' || config.transport === 'both') {
            var transporterOsc = _.where(transporter, {
              name: 'osc'
            })
            if (transporterOsc.length > 0) {
              transporterOsc[0].send(relativePath, 'image-deleted')
            } else {
              console.log('Sorry we can not send using OSC, no transport available')
            }

          }
        } catch (err) {
          console.log(err)
        }
      } else {
        console.log('File', path, 'should be ignored')
      }
      console.log('File', path, 'has been removed')
    })
    .on('unlinkDir', function (path) {
      console.log('Chokidar: Directory', path, 'has been removed')
    })
    .on('error', function (error) {
      console.error('Chokidar: Error happened', error)
    })
    .on('ready', function () {
      console.info('Chokidar: Initial scan complete. Ready for changes.')
    })
    .on('raw', function (event, path, details) {
    })
}

module.exports = initWatcher