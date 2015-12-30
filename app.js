'use strict'

var config = require('./config/config.json')
var _ = require('lodash')
var util = require('util')
var mdns = require('mdns')
var mkdirp = require('mkdirp')
var clc = require('cli-color')
var express = require('express')
var ip = require('ip')
var fs = require('fs')
var pathHelper = require('path')
var currentServiceAddress = ''
var serverHttp
var transporter = []
var namespaces = []
var host = ''
var connected = false
var lastFile = ''
var app

process.title = 'watchy-' + config.servicelookup.name

var initTransporter = require('./transporter.js')
var initWatcher = require('./watcher.js')

var initStatiqueServer = function () {
  app = express()
  var options = {
    dotfiles: 'ignore',
    etag: false,
    extensions: ['htm', 'html'],
    index: false,
    maxAge: '1d',
    redirect: false,
    setHeaders: function (res, path, stat) {
      res.set('x-timestamp', Date.now())
      res.set('', Date.now())
    }
  }
  app.use(express.static(config.watch.path, options))
  serverHttp = require('http').Server(app)
}

console.log(clc.blue('Initializing...'))

if (fs.existsSync(config.watch.path)) {
  initStatiqueServer()
  initTransporter()
  // should update the transporter list as soon as new connection come
  initWatcher(config, transporter)
  console.log(clc.green('...Initialized'))
  // Output
  var os = require('os')
  host = os.hostname()
  if (os.platform() === 'linux') {
    var child_process = require('child_process')
    child_process.exec('hostname -f', function (err, stdout, stderr) {
      host = stdout.trim()
      // hot and dirty fix
      if (host.indexOf('local') < 0) {
        host += '.local'
      }
    })
  }
  require('dns').resolve('www.google.com', function (err) {
    if (err) {
      console.log(clc.red('No internet connection, serving from localhost'))
      host = '127.0.0.1'
    }
  })
  console.log('Watching: ' + config.watch.path)
  console.log(clc.blue('Listening on: ') + clc.green('http://' + ip.address() + ':' + config.port))
  serverHttp.listen(config.port)
    .on('error', function (err) {
      console.log(err)
      process.exit(1)
    })
} else {
  console.log(clc.red("Sorry, we can't watch something that does not exist: " + config.watch.path))
}
