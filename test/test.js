'use strict';

var expect = require('expect.js');
var io = require('socket.io-client');
var config = require('./config/config.test');
var watchy = require('../watchy');

var addresses = {
  client: 'http://' + config.client.address + ':' + config.client.port
};

var options ={
  transports: ['websocket'],
  'force new connection': true
};

describe("Client",function(){
  before(function (done){
    watchy.initStatiqueServer();
    watchy.initTransporter();

    setTimeout(function(){
      done();
    }, 100);
  });
  describe('socket.io', function(){
    it('should receive namespace on connection', function (done){
      expect(watchy.namespaces).not.to.be.empty();
      for (var i = 0; i < watchy.namespaces.length; i++) {
        expect(watchy.namespaces[i]).to.match(/^\/\w*$/gi);
      };
      done();
    });
    it('should create a transporter from this namespaces', function (done){
      expect(watchy.transporter).not.to.be.empty();
      expect(watchy.transporter[0].send('/', 'image-saved')).to.be(true);
      done();
    });
  })
});
