var exec = require('child_process').exec
var mkdirp = require('mkdirp')
var maxPort = 65
var portNumber = 1
var path = require('path')

while (portNumber < maxPort) {
  mkdirp('./example/' + portNumber, function infoMkdir(err) {
    if (err) console.error('Error while creating directory: ', err)
  })
  var child = exec('node app.js --dir="' + path.resolve('./example/' + portNumber) + '" --port=' + Number(3002 + portNumber))
  console.log('Instantiate: node app.js --dir=' + path.resolve('./example/' + portNumber) + ' --port=' + Number(3002 + portNumber))
  child.stdout.on('data', function dataComing(data) {
    console.log('watchy-' + this + ': ' + data)
  }.bind(portNumber))
  child.stderr.on('data', function stderrInfo(data) {
    console.log('watchy-' + this + ' stdout: ' + data)
  }.bind(portNumber))
  child.on('close', function closing(code) {
    console.log('watchy-' + this + ' closing code: ' + code)
  }.bind(portNumber))
  portNumber++ 
}
