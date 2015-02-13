'use strict';

var watchy = require('./watchy');
var fs = require('fs');
var config = require('./config/config');
var host;

console.log("Initializing...");

if (fs.existsSync(config.watch.path)) {
  watchy.initStatiqueServer();
  watchy.initTransporter();
  //TODO add some ready event to tell the watcher to init.
  watchy.initWatcher();
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
  watchy.app.listen(config.port)
    .on('error', function(err) {
      console.log(err);
      process.exit(1);
    });
} else {
  console.log('Sorry, we can\'t watch something that does not exist: ', config.watch.path);
}