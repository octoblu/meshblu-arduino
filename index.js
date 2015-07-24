'use strict';
var util = require('util');
var EventEmitter = require('events').EventEmitter;
//var debug = require('debug')('meshblu-arduino')
var _ = require("underscore");
var five = require("johnny-five");
//var board = new five.Board();
var Oled = require('oled-js');
var font = require('oled-font-5x7');
var debug = require('debug')('dynamic');
var board;


var names = [];
var component = {};
var functions = [];
var read = {};
var components;
var servo = [];
var oled = [];
var lcd = [];

var boardReady = false;

var MESSAGE_SCHEMA = {
  "type": "object",
  "properties": {
    "name": {
      "title": "Name",
      "type": "string",
      "enum": names
    },
    "value": {
      "title": "Value",
      "type": "string"
    }
  }
};

// connect
var OPTIONS_SCHEMA = {
  "type": "object",
  "title": "Component",
  "required": [
    "components"
  ],
  "properties": {
    "port":{
      "type": "string",
      "description": "Leave this blank to auto-detect a FIRMATA Arduino board on serial.",
      "required": false
    },
    "components": {
      "type": "array",
      "maxItems": 2,
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "title": "Name",
            "type": "string",
            "description": "Name this component anything you like. (i.e Left_Motor). Sensor output will show up under this name in payload",
            "required": true
          },
          "action": {
            "title": "Action",
            "type": "string",
            "enum": ["digitalWrite", "digitalRead", "analogWrite", "analogRead", "servo", "PCA9685-Servo", "oled-i2c" , "LCD-PCF8574A", "LCD-JHD1313M1"],
            "required": true
          },
          "pin": {
            "title": "Pin",
            "type": "string",
            "description": "Pin or i2c address used for this component",
            "required": true
          }

        },
        "required": [
          "name",
          "pin",
          "action"
        ]
      }
    }
  }
};

var OPTIONS_FORM = [

  {
    "key": "components",
    "add": "New",
    "style": {
      "add": "btn-success"
    },
    "items": [
      "components[].name",
      "components[].action",
      "components[].pin"
    ]
  }, {
    "type": "submit",
    "style": "btn-info",
    "title": "OK"
  }
];

var FORMSCHEMA = ["*"];

var testOptions = {
  "components": [{
    "name": "Led_Pin_13",
    "action": "digitalWrite",
    "pin": "13"
  }, {
    "name": "some_sensor",
    "action": "analogRead",
    "pin": "3"
  }, {
    "name": "Servo1",
    "action": "servo",
    "pin": "6"
  }]
};





function Plugin(){
  this.options = {};
  this.messageSchema = MESSAGE_SCHEMA;
  this.optionsSchema = OPTIONS_SCHEMA;
  return this;
}
util.inherits(Plugin, EventEmitter);

Plugin.prototype.StartBoard = function(device){

  var self = this;

  if(!boardReady){
    if(device.options.port){
      board = new five.Board({ port: device.options.port });
    }else{

      board = new five.Board();

    }

    board.on('ready', function() {

      boardReady = true;



    }); // end johnny-five board onReady

  }


}

Plugin.prototype.onMessage = function(message){
  var payload = message.payload;
  var value = parseInt(payload.value);
    if (!component[payload.name])
      return;

    switch (component[payload.name].action) {
      case "digitalWrite":
        board.digitalWrite(component[payload.name].pin, value);
        break;
      case "analogWrite":
        board.analogWrite(component[payload.name].pin, value);
        break;
      case "servo":
        debug('servo', servo);
        servo[payload.name].stop();
        servo[payload.name].to(value);
        break;
      case "PCA9685-Servo":
        servo[payload.name].stop();
        servo[payload.name].to(value);
        break;
      case "oled-i2c":
        oled[payload.name].turnOnDisplay();
        oled[payload.name].clearDisplay();
        oled[payload.name].update();
        oled[payload.name].setCursor(1, 1);
        oled[payload.name].writeString(font, 3, payload.value , 1, true);
        break;
        case "LCD-PCF8574A":
            lcd[payload.name].clear();
            if(payload.value.length <= 16){
            lcd[payload.name].cursor(0,0).noAutoscroll().print(payload.value);
          }else if (payload.value.length > 16){
            lcd[payload.name].cursor(0,0).print(payload.value.substring(0,16));
            lcd[payload.name].cursor(1,0).print(payload.value.substring(16,33));
          }
          break;
        case "LCD-JHD1313M1":
            lcd[payload.name].clear();
            if(payload.value.length <= 16){
            lcd[payload.name].cursor(0,0).noAutoscroll().print(payload.value);
          }else if (payload.value.length > 16){
            lcd[payload.name].cursor(0,0).print(payload.value.substring(0,16));
            lcd[payload.name].cursor(1,0).print(payload.value.substring(16,33));
          }
          break;
    } //end switch case
};



Plugin.prototype.checkConfig = function(data){

      if (_.has(data.options, "components")) {
        this.configBoard(data);
      } else if (!(_.has(data.options, "components"))) {
        this.emit('updateOptions', testOptions);
        data.options = testOptions;
        this.configBoard(data);
      }


};

Plugin.prototype.configBoard = function(data) {

if(boardReady == true){
        component = [];
        servo = [];
        names = [];
        read = {};
        oled = [];
        lcd = [];

        if (_.has(data.options, "components")) {
          components = data.options.components;
        } else {
          components = testOptions.components;
        }

        components.forEach(function(payload) {
          debug(payload);

          if(!(_.has(payload, "pin"))){
            return;
          }

          component[payload.name] = {
            "pin": payload.pin,
            "action": payload.action
          };

          switch (payload.action) {
            case "digitalRead":
              debug("digitalRead");
              board.pinMode(payload.pin, five.Pin.INPUT);
              board.digitalRead(payload.pin, function(value) {
                if(_.has(component, payload.name)){
                read[payload.name] = value;
                debug(value);
                }
              });

              break;
            case "digitalWrite":
              board.pinMode(payload.pin, board.MODES.OUTPUT);
              names.push(payload.name);
              break;
            case "analogRead":

              board.pinMode(payload.pin, five.Pin.ANALOG);
              board.analogRead(payload.pin, function(value) {
                if(_.has(component, payload.name)){
                read[payload.name] = value;
                }
              });
              break;
            case "analogWrite":
              board.pinMode(payload.pin, five.Pin.PWM);
              names.push(payload.name);
              break;
            case "servo":
              servo[payload.name] = new five.Servo({
                pin: payload.pin,
              });
              names.push(payload.name);
              break;
            case "PCA9685-Servo":
              servo[payload.name] = new five.Servo({
                address: 0x40,
                controller: "PCA9685",
                pin: payload.pin,
              });
              names.push(payload.name);
            case "oled-i2c":
                  debug("oledddoo");
                  var opts = {
                        width: 128,
                        height: 64,
                        address: parseInt(payload.pin)
                      };
                  oled[payload.name] = new Oled(board, five, opts);
                  oled[payload.name].clearDisplay();
                  oled[payload.name].setCursor(1, 1);
                  oled[payload.name].writeString(font, 3, 'Skynet Lives', 1, true);
                  oled[payload.name].update();
                  names.push(payload.name);
              break;
            case "LCD-PCF8574A":
                lcd[payload.name] = new five.LCD({
                              controller: "PCF8574A",
                              rows: 2,
                              cols: 16
                              });
                lcd[payload.name].cursor(0, 0).print("Skynet Lives");
                names.push(payload.name);

              break;
            case "LCD-JHD1313M1":
                lcd[payload.name] = new five.LCD({
                              controller: "JHD1313M1",
                              rows: 2,
                              cols: 16
                              });
                lcd[payload.name].cursor(0, 0).print("Skynet Lives");
                names.push(payload.name);
              break;



          } //end switch case


        }); // end for each

        MESSAGE_SCHEMA = {
          "type": "object",
          "properties": {
            "name": {
              "title": "Name",
              "type": "string",
              "enum": names
            },
            "value": {
              "title": "Value",
              "type": "string"
            }
          }
        }


        this.emit('updateConfig', {
          "messageSchema": MESSAGE_SCHEMA,
          "messageFormSchema": FORMSCHEMA,
          "optionsSchema": OPTIONS_SCHEMA,
          "optionsForm": OPTIONS_FORM
        });

      }else{

        this.emit('config');

      }

      }; // end configBoard



Plugin.prototype.onConfig = function(device){
  this.setOptions(device.options||{});
  this.emit('config');
};



Plugin.prototype.setOptions = function(options){
  this.options = options;
};

Plugin.prototype.Read = function(){
var self = this;

setInterval(function() {


    if (!(_.isEmpty(read))) {
      debug(read);

      self.emit('message',{
        "devices": "*",
        "payload": read
      });

    }


  }, 1000);

};

module.exports = {
  messageSchema: MESSAGE_SCHEMA,
  optionsSchema: OPTIONS_SCHEMA,
  Plugin: Plugin
};
