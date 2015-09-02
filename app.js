'use strict';
//TODO : add namespace for client mode !

var config = require('./config/config.json'),
  _ = require('lodash'),
  util = require('util'),
  clc = require('cli-color'),
  express = require('express'),
  ip = require('ip'),
  fs = require('fs'),
  fileWatcher = require('./fileWatcher/index.js'),
  fileSender = require('./fileSender/index.js');

// Local variables
var currentServiceAddress = '',
  serverHttp,
  transporter = [],
  host = '',
  connected = false,
  app;

process.title = 'watchy-' + config.servicelookup.name;

var initStaticServer = function() {
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

console.log(clc.blue("Initializing Watchy ..."));

if (fs.existsSync(config.watch.path)) {
  initStaticServer();
  fileSender.init(transporter); // init transporter TODO: Better name
  //TODO add some ready event to tell the watcher to init.
  fileWatcher.init(host, transporter);

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
        host += '.local';
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