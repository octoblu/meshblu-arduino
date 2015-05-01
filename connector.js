'use strict';
var Plugin = require('./index').Plugin;
var meshblu = require('meshblu');
var RemoteIO = require('remote-io');
var SkynetSerialPort = require('meshblu-virtual-serial').SerialPort;
var five = require("johnny-five")

var Connector = function(config) {
  var conx = meshblu.createConnection({
    server : config.server,
    port   : config.port,
    uuid   : config.uuid,
    token  : config.token
  });

  var consoleError = function(error) {
    console.error(error.message);
    console.error(error.stack);
  };

  process.on('uncaughtException', consoleError);
  conx.on('notReady', consoleError);
  conx.on('error', consoleError);

  var plugin = new Plugin();

  conx.on('ready', function(){
    conx.whoami({uuid: config.uuid}, function(device){
      plugin.setOptions(device.options || {});
      conx.update({
        uuid: config.uuid,
        token: config.token,
        messageSchema: plugin.messageSchema,
        optionsSchema: plugin.optionsSchema,
        options:       plugin.options
      });
    });

  //virtual port
    var ssp = new SkynetSerialPort(conx);

    var io = new five.Board({repl: false});
    //virtual serialport + any io
    var remoteio = new RemoteIO({
      serial: ssp,
      io: io
    });
  });




  conx.on('message', function(){
    try {
      plugin.onMessage.apply(plugin, arguments);
    } catch (error){
      console.error(error.message);
      console.error(error.stack);
    }
  });

  conx.on('config', function(){
    try {
      plugin.onConfig.apply(plugin, arguments);
    } catch (error){
      console.error(error.message);
      console.error(error.stack);
    }
  });

  plugin.on('message', function(message){
    conx.message(message);
  });

  plugin.on('error', consoleError);
};

module.exports = Connector;
