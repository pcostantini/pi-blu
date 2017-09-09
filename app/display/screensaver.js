module.change_code = 1;

var _ = require('lodash');
var inherits = require('util').inherits;
var BaseDisplay = require('./base-display');

var DottedFilter = require('./dotted-filter');
var NoisyFilter = require('./noisy-filter');
var utils = require('../utils');

var width = 64;
var height = 128;
var speedAccumulator = [];

function ScreenSaverDisplay(driver, events, stateStore) {
  BaseDisplay.call(this, driver, events, stateStore);
}
inherits(ScreenSaverDisplay, BaseDisplay);

ScreenSaverDisplay.prototype.init = function (driver, stateStore) {
  drawAll(driver, stateStore.getState());
}
ScreenSaverDisplay.prototype.preFlush = function (driver, stateStore) {
  drawAll(driver, stateStore.getState());
}
ScreenSaverDisplay.prototype.processEvent = function (driver, e, stateStore) {
  switch (e.name) {

    case 'Gps':
      var speed = e.value ? e.value.speed : NaN;
      drawSpeed(driver, speed);
      break;

    case 'MagnometerHeading':
    case 'Acceleration':
    case 'MagnometerAxis':
      break;

    case 'Ticks':
      var state = stateStore.getState();
      var speed = state.Gps ? state.Gps.speed : 0;

      if (!_.isNumber(speed)) {
        speed = 0;
      }

      speedAccumulator.push(speed);
      if(speedAccumulator.length > keepN) {
        speedAccumulator = speedAccumulator.slice(speedAccumulator.length - keepN);
      }

      break;
  }
}

module.exports = ScreenSaverDisplay;

function drawAll(driver, state) {
  if (!state) return;
  var speed = state.Gps ? state.Gps.speed : NaN;
  drawBackground(driver, state);
  drawSpeed(driver, speed, true);
};

var offsetX = 9;
var offsetY = 15;

var takeN = 3;
var previousN = 10;
var keepN = takeN + previousN;
function drawBackground(driver, state) {
  var speed = (state.Gps ? state.Gps.speed : 0) || 0;
  var radious = (speed + 1) * Math.PI;

  var filter = DottedFilter(driver);
  driver.fillRect(0, 64, 64, 64, 0)
  filter.dispose();


  var centerX = width / 2 + offsetX;
  var centerY = 92 + offsetY;
  var filter = NoisyFilter(driver);
  driver.drawCircle(centerX, centerY, radious, true);
  driver.drawCircle(centerX, centerY - 1, radious, true);
  filter.dispose();

  var a = speedAccumulator;
  var lastN = a.slice(a.length - takeN);
  var previous = a.slice(0, a.length - takeN);

  var previousSpeedAvg = utils.mpsToKph(average(previous));
  var currentSpeedAvg = utils.mpsToKph(average(lastN));

  // console.log({
  //   prev: previous.join(','),
  //   last: lastN.join(',') ,
  //   prevAvg: previousSpeedAvg,
  //   lastAvg: currentSpeedAvg
  // });

  var modifier = 1.95;
  var filter = DottedFilter(driver);
  driver.drawLine(previousSpeedAvg * modifier, 8, currentSpeedAvg * modifier, 127, true);
  filter.dispose();
}

var currentSpeed = NaN;
function drawSpeed(driver, speed, force) {
  if (!force && speed === currentSpeed) return;
  currentSpeed = speed;

  driver.fillRect(12, 90, 52, 26, 0)

  var kmPh = !isNaN(speed) ? utils.mpsToKph(speed) : NaN;
  driver.setCursor(18, height - 50 + offsetY);
  driver.setTextColor(1, 0);
  var isNan =!isNaN(kmPh)
  var sKmPh = isNan ? toFixed(kmPh, 1) : '-.-';
  if(!isNan) {
    driver.setTextSize(3);
  } else {
    driver.setTextSize(4);
  }
  write(driver, sKmPh)
}

function write(driver, string) {
  var chars = string.split('');
  var filter = DottedFilter(driver);
  chars.forEach((c) => {
    driver.write(c.charCodeAt(0));
  });
  filter.dispose();
}

var r0 = Math.PI * Math.PI;
var r = r0;
function getRandomArbitrary() {
  r = r + 0.333;
  if (r > 45) {
    r = r0;
  }

  console.log('r', r)
  return r;
}


function toFixed(value, precision) {
  var precision = precision || 0,
    power = Math.pow(10, precision),
    absValue = Math.abs(Math.round(value * power)),
    result = (value < 0 ? '-' : '') + String(Math.floor(absValue / power));

  if (precision > 0) {
    var fraction = String(absValue % power),
      padding = new Array(Math.max(precision - fraction.length, 0) + 1).join('0');
    result += '.' + padding + fraction;
  }
  return result;
}

// https://gist.github.com/JamieMason/1111276
function average(arr) {
  return _.reduce(arr, function (memo, num) {
    return memo + num;
  }, 0) / (arr.length === 0 ? 1 : arr.length);
}