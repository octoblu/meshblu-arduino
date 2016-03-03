'use strict';
var util         = require('util');
var _            = require('lodash');
var EventEmitter = require('events').EventEmitter;
var debug        = require('debug')('meshblu-arduino:index');
var Kryten = require('kryten');
var kryten = new Kryten({});
var defaultSchema = require('./schema.json')
var prev = {};
var FORMSCHEMA = ["*"];
var testOptions = defaultSchema.testOptions;

function Plugin(){
  this.options = testOptions;
  this.messageSchema = defaultSchema.MESSAGE_SCHEMA;
  this.optionsSchema = defaultSchema.OPTIONS_SCHEMA;
  return this;
}
util.inherits(Plugin, EventEmitter);

Plugin.prototype.update = function(properties){
  var self = this;
  self.emit('update', properties);
};

Plugin.prototype.startKryten = function () {
  var self = this;
  self.emit('update', {});

  kryten.on('ready', function(){
    kryten.on('schema', function(schema) {
      Plugin.prototype.update({
        "messageSchema": schema.MESSAGE_SCHEMA,
        "messageFormSchema": schema.FORMSCHEMA,
        "optionsSchema": defaultSchema.OPTIONS_SCHEMA,
        "optionsForm": defaultSchema.OPTIONS_FORM
      });
    });

    kryten.on('data', function(data){
      self.emit('message', {
        "devices": "*",
        "payload": data
      })
    });
  });
};

Plugin.prototype.startKryten();

Plugin.prototype.onMessage = function(message){
  kryten.onMessage(message);
};

Plugin.prototype.setOptions = function(device){
  var self = this;
  self.options = device.options || testOptions
};

Plugin.prototype.onConfig = function(device){
  if(!_.isEqual(device.options, prev)){
    kryten.configure(device.options);
    prev = device.options;
  }
};

module.exports = {
  messageSchema: defaultSchema.MESSAGE_SCHEMA,
  optionsSchema: defaultSchema.OPTIONS_SCHEMA,
  options: testOptions,
  Plugin: Plugin
};
