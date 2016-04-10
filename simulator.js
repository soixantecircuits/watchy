'use strict'

// The simulator add images to folders watched. It removes them "offsetTimeout" seconds
// after the three have been walk. 
// It keeps running every intervalAdd time.

var fs = require('fs-extra')
var path = require('path')
var walk = require('walkdir')
var locationPath = './calibration_example'
var copyPath = './example'
var intervalAdd = 25000
var offsetTimeout = 10000

var addImages = function() {
  var walker = walk(locationPath, function founded(pathFound, fileStat) {
    // ignore all .git directories.
    if (path.basename(pathFound) === '.git' || path.basename(pathFound) === '.DS_Store') {
      this.ignore(pathFound)
    } else {
      try {
        fs.copySync(pathFound, path.join(copyPath, path.basename(pathFound).replace(path.extname(pathFound), ''), path.basename(pathFound)))
        console.log('success! for:', path.basename(pathFound))
      } catch (err) {
        console.error(err)
      }
    }
  })
  walker.on('end', function(){
    setTimeout(function removeTimeout() {
      removeImages()
    }, offsetTimeout)
  })
}

var removeImages = function() {
  walk(copyPath, function founded(pathFound, fileStat) {
    console.log(pathFound)
    if (path.extname(pathFound) === '.jpg') {
      fs.remove(pathFound, function(err) {
        if (err) return console.error(err)
        console.log('deleted: ', path.basename(pathFound))
      })
    }
  })
}

// Autostart copy images
setInterval(function rescan(){
  addImages()
}, intervalAdd)

//Start imediately 
addImages()