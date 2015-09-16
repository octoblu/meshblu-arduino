'use strict';
var util         = require('util');
var EventEmitter = require('events').EventEmitter;
var _            = require('lodash');
var five         = require('johnny-five');
var Oled         = require('oled-js');
var font         = require('oled-font-5x7');
var debug        = require('debug')('meshblu-arduino:index');
var board;

var names = [];
var component = {};
var functions = [];
var read = {};
var components;
var servo = [];
var oled = [];
var lcd = [];
var accel= [];
var prevData = {};

var map = [];
var action_map = [];

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
var OPTIONS_SCHEMA =  {
  "type": "object",
  "title": "Component",
  "required": [
    "components"
  ],
  "properties": {
    "port":{
      "type": "string",
      "description": "Leave this blank to auto-detect a FIRMATA Arduino board on serial.",
      "required": false,
      "default": "auto-detect"
    },
    "interval":{
      "type": "string",
      "enum": ["500", "1000", "1500", "2000", "200" ],
      "description": "The Interval in milliseconds to send Sensor readings.",
      "required": false,
      "default": "500"
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
            "enum": ["digitalWrite", "digitalRead", "analogWrite", "analogRead", "servo", "PCA9685-Servo", "oled-i2c" , "LCD-PCF8574A", "LCD-JHD1313M1c", "MPU6050"],
            "required": true
          },
          "pin": {
            "title": "Pin",
            "type": "string",
            "description": "Pin used for this component",
            "required": false
          },
          "address": {
            "title": "address",
            "type": "string",
            "description": "i2c address used for this component",
            "required": false
          }
        },
        "required": [
          "name",
          "action"
        ]
      }
    }
  }
};

var OPTIONS_FORM = [
  "port",
  "interval",
  {
    "key": "components",
    "add": "New",
    "style": {
      "add": "btn-success"
    },
    "items": [
      "components[].name",
      "components[].action",
      {
        "key": "components[].pin",
        "condition": "model.components[arrayIndex].action=='digitalRead' || model.components[arrayIndex].action=='digitalWrite' || model.components[arrayIndex].action=='analogRead' || model.components[arrayIndex].action=='analogWrite' || model.components[arrayIndex].action=='servo'"
      },
      {
        "key": "components[].address",
        "condition": "model.components[arrayIndex].action=='oled-i2c' || model.components[arrayIndex].action=='LCD-PCF8574A' || model.components[arrayIndex].action=='LCD-JHD1313M1' || model.components[arrayIndex].action=='PCA9685-Servo'"
      }
    ]
  }, {
    "type": "submit",
    "style": "btn-info",
    "title": "OK"
  }
]
;

var FORMSCHEMA = ["*"];

var testOptions = {
  "port": "auto-detect",
  "interval": "500",
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
  this.options = testOptions;
  this.messageSchema = MESSAGE_SCHEMA;
  this.optionsSchema = OPTIONS_SCHEMA;
  return this;
}
util.inherits(Plugin, EventEmitter);

Plugin.prototype.StartBoard = function(device){

  var self = this;

  if(!boardReady){
    if(device.options.port != "auto-detect"){
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
      payload.name = payload.component;

  if (!component[payload.name]) return;

  debug(component[payload.name]);
  switch (component[payload.name].action) {
    case "digitalWrite":
      var value = parseInt(payload.state);
      board.digitalWrite(component[payload.name].pin, value);
      break;
    case "analogWrite":
      var value = payload.value;
      debug("analog STUFF", value);
      debug("pinsssc", component[payload.name].pin);
      board.analogWrite(parseInt(component[payload.name].pin), value);
      break;
    case "servo":
      debug('servo', servo);
      if(payload.servo_action == "to"){
        var value = payload.to_value;
        servo[payload.name].stop();
        servo[payload.name].to(value);
      }else if(payload.servo_action == "sweep"){
        servo.sweep([payload.sweep.min, payload.sweep.max]);
      }else if(payload.servo_action == "stop"){
        servo[payload.name].stop();
      }
      break;
    case "PCA9685-Servo":
      if(payload.servo_action == "to"){
        var value = payload.to_value;
        servo[payload.name].stop();
        servo[payload.name].to(value);
      }else if(payload.servo_action == "sweep"){
        servo.sweep([payload.sweep.min, payload.sweep.max]);
      }else if(payload.servo_action == "stop"){
        servo[payload.name].stop();
      }
      break;
    case "oled-i2c":
      oled[payload.name].turnOnDisplay();
      oled[payload.name].clearDisplay();
      oled[payload.name].update();
      oled[payload.name].setCursor(1, 1);
      oled[payload.name].writeString(font, 3, payload.text , 1, true);
      break;
    case "LCD-PCF8574A":
      lcd[payload.name].clear();
      if(payload.text.length <= 16){
        lcd[payload.name].cursor(0,0).noAutoscroll().print(payload.text);
      }else if (payload.text.length > 16){
        lcd[payload.name].cursor(0,0).print(payload.text.substring(0,16));
        lcd[payload.name].cursor(1,0).print(payload.text.substring(16,33));
      }
      break;
    case "LCD-JHD1313M1":
      lcd[payload.name].clear();
      if(payload.text.length <= 16){
        lcd[payload.name].cursor(0,0).noAutoscroll().print(payload.text);
      }else if (payload.text.length > 16){
        lcd[payload.name].cursor(0,0).print(payload.text.substring(0,16));
        lcd[payload.name].cursor(1,0).print(payload.text.substring(16,33));
      }
      break;
  } //end switch case
};

Plugin.prototype.checkConfig = function(data){
  if(boardReady){
    if(_.isEqual(data.options, prevData.options)) return
    if (_.has(data.options, "components")) {
      this.configBoard(data);
    } else if (!(_.has(data.options, "components"))) {
      this.emit('update', {options: testOptions});
      data.options = testOptions;
      this.configBoard(data);
    }
    prevData = data;
  }else{
    this.emit('config');
  }
};

Plugin.prototype.configBoard = function(data) {
  var self = this;
  if(boardReady == true){
    component = [];
    servo = [];
    names = [];
    read = {};
    oled = [];
    accel= [];
    lcd = [];
    map = [];
    action_map = [];

    if (_.has(data.options, "components")) {
      components = data.options.components;
    } else {
      components = testOptions.components;
    }

    components.forEach(function(payload) {
      debug(payload);

      if(!_.has(payload, "pin") && !_.has(payload, "address")) return;

      if(_.has(payload, "pin")){
        component[payload.name] = {
          "pin": payload.pin,
          "action": payload.action
        };
      }

      if(_.has(payload, "address")){
        component[payload.name] = {
          "address": payload.address,
          "action": payload.action
        };
      }

      debug(component);
      switch (payload.action) {
        case "digitalRead":
          debug("digitalRead");
          board.pinMode(payload.pin, five.Pin.INPUT);
          board.digitalRead(payload.pin, function(value) {
            if(_.has(component, payload.name)){
              read[payload.name] = value;
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
        board.pinMode(parseInt(payload.pin), five.Pin.PWM);
        names.push(payload.name);
        break;
      case "servo":
        servo[payload.name] = new five.Servo({
          pin: parseInt(payload.pin),
        });
        names.push(payload.name);
        break;
      case "servo-continuous":
        servo[payload.name] = new five.Servo.Continuous(parseInt(payload.pin)).stop();
        names.push(payload.name);
        break;

      case "PCA9685-Servo":
        var address = parseInt(payload.address) || 0x40;
        servo[payload.name] = new five.Servo({
          address: address,
          controller: "PCA9685",
          pin: payload.pin
        });
        names.push(payload.name);
      case "oled-i2c":
        debug("oledddoo");
        var address = parseInt(payload.address) || 0x3C;
        var opts = {
          width: 128,
          height: 64,
          address: address
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
      case "MPU6050":
        var addr = parseInt(payload.address) || 0x68;
        accel[payload.name] = new five.IMU({
          controller: "MPU6050",
          address: addr
        });
        accel[payload.name].on("data", function(err, data) {
          values = {};
          values["accel"] = {"x": this.accelerometer.x , "y": this.accelerometer.y, "z": this.accelerometer.z};
          values["gyro"] = {"x": this.gyro.x , "y": this.gyro.y, "z": this.gyro.z};
          values["temp"] = {"temperature" : this.temperature.celsius};
          read[payload.name] = values;
        });
        break;
      } //end switch case

    }); // end for each

    var servo_ = [];
    var digital_ = [];
    var analog_ = [];
    var text_ = [];
    var continuous_ = [];

    for(var i = 0; i < names.length; i++){
      var name = names[i];
      debug(name);
      debug(component[name]);

      var data = { "value": name,
        "name" : name,
        "group" : component[name].action
      };

      if(component[name].action == "servo"){
        servo_.push(name);
      }else if(component[name].action == "digitalWrite"){
        digital_.push(name);
      }else if(component[name].action == "servo-continuous"){
        continuous_.push(name);
      }else if(component[name].action == "analogWrite"){
        analog_.push(name);
      }else{
        text_.push(name);
      }
      map.push(data);
    }

    var servo_condition = "model.component == 'aNeverEndingSchema'";
    var digital_condition =  "model.component == 'aNeverEndingSchema'";
    var analog_condition =  "model.component == 'aNeverEndingSchema'";
    var text_condition =  "model.component == 'aNeverEndingSchema'";
    var servoc_condition =  "model.component == 'aNeverEndingSchema'";

    if(servo_ !== undefined){
      for(var i = 0; i < servo_.length; i++){
        if(i == 0){
          servo_condition = "model.component == '" + servo_[i] + "'";
        }else{
          servo_condition = servo_condition + " || model.component == '" + servo_[i] + "'";
        }
      }
    }
    if(digital_ !== undefined){
      for(var i = 0; i < digital_.length; i++){
        if(i == 0){
          digital_condition = "model.component == '" + digital_[i] + "'";
        }else{
          digital_condition = digital_condition + " || model.component == '" + digital_[i] + "'";
        }
      }
    }
    if(analog_ !== undefined){
      for(var i = 0; i < analog_.length; i++){
        if(i == 0){
          analog_condition = "model.component == '" + analog_[i] + "'";
        }else{
          analog_condition = analog_condition + " || model.component == '" + analog_[i] + "'";
        }
      }
    }
    if(text_ !== undefined){
      for(var i = 0; i < text_.length; i++){
        if(i == 0){
          text_condition = "model.component == '" + text_[i] + "'";
        }else{
          text_condition = text_condition + " || model.component == '" + text_[i] + "'";
        }
      }
    }
    if(continuous_ !== undefined){
      for(var i = 0; i < continuous_.length; i++){
        if(i == 0){
          servoc_condition = "model.component == '" + continuous_[i] + "'";
        }else{
          servoc_condition = servoc_condition + " || model.component == '" + continuous_[i] + "'";
        }
      }
    }

    MESSAGE_SCHEMA = {
      "type": "object",
      "properties": {
        "component": {
          "title": "Component",
          "type": "string"
        },
        "to_value": {
          "title": "Value",
          "type": "string"
        },
        "value": {
          "title": "Value",
          "type": "number"
        },
        "direction": {
          "title": "Direction",
          "type": "string",
          "enum": ["CW", "CCW", "STOP"]
        },
        "text": {
          "title": "Text",
          "type": "string"
        },
        "state": {
          "title": "state",
          "type": "string",
          "enum": ["0", "1"]
        },
        "servo_action": {
          "type" : "string",
          "enum" : ["to", "sweep", "stop"]
        },
        "sweep":{
          "type": "object",
          "properties":{
            "min": {
              "type" : "number"
            },
            "max": {
              "type" : "number"
            }
          }
        }
      }
    };

    var servo_sweep = "model.servo_action == 'sweep' && " + servo_condition;
    var servo_to = "model.servo_action == 'to' && " + servo_condition;

    FORMSCHEMA = [
      {
        "key": "component",
        "type": "select",
        "titleMap": map
      },
      {
        "key": "servo_action",
        "condition": servo_condition
      },
      {
        "key": "sweep",
        "condition": servo_sweep
      },
      {
        "key": "to_value",
        "condition": servo_to
      },
      {
        "key": "state",
        "condition": digital_condition
      },
      {
        "key": "value",
        "condition": analog_condition
      },
      {
        "key": "text",
        "condition": text_condition
      },
      {
        "key": "direction",
        "condition": servoc_condition
      }
    ];

    self.emit('update', {
      "messageSchema": MESSAGE_SCHEMA,
      "messageFormSchema": FORMSCHEMA,
      "optionsSchema": OPTIONS_SCHEMA,
      "optionsForm": OPTIONS_FORM
    });

  }else{
    setTimeout(function () {
      self.emit('config');
    }, 1000)
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

  var interval = parseInt(self.options.interval) || 1000;

  debug("interval is:", interval);

  setInterval(function() {
    if (!(_.isEmpty(read))) {
      self.emit('message',{
        "devices": "*",
        "payload": read
      });
    }
  }, interval);

};

module.exports = {
  messageSchema: MESSAGE_SCHEMA,
  optionsSchema: OPTIONS_SCHEMA,
  options: testOptions,
  Plugin: Plugin
};
