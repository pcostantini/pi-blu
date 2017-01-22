module.change_code = 1;

var _ = require('lodash');
var inherits = require('util').inherits;
var BaseDisplay = require('./base-display');
var DottedFilter = require('./dotted-filter');
var NoisyFilter = require('./noisy-filter');

var width = 64;
var height = 128;

function OverviewDisplay(driver, events, stateStore) {
  BaseDisplay.call(this, driver, events, stateStore);
}

inherits(OverviewDisplay, BaseDisplay);

OverviewDisplay.prototype.init = function (driver, stateStore) {
  this.refreshDisplayDelay = 1000;
  drawAll(driver, stateStore.getState());
}

// OverviewDisplay.prototype.dispose = function() {
//   this.noiseFilter.dispose();
//   BaseDisplay.prototype.dispose.call(this);
// }

OverviewDisplay.prototype.processEvent = function (driver, e, stateStore) {
  switch (e.name) {
    case 'Distance':
      drawDistance(driver, e.value);
      break;

    case 'Gps':
      drawSpeed(driver, e.value ? e.value.speed : NaN);
      drawAltitude(driver, e.value ? e.value.altitude : NaN);
      drawMapPoint(driver, e.value, stateStore);

      // todo: draw altidudes

      break;

    case 'Ticks':
      drawTime(driver, e.value);
      break;

    case 'Barometer':
      drawTemp(driver, e.value.temperature, e.value.pressure);
      break;

    case 'Input:B':
      zoom(driver, stateStore);
      break;

  }
};

module.exports = OverviewDisplay;

function drawAll(driver, state) {
  state = state || {};

  drawSpeed(driver, state.Gps ? state.Gps.speed : NaN);
  drawTime(driver, state.Ticks);
  drawMap(driver, state.Path || { points: [] });
  drawDistance(driver, state.Distance);
  drawAltitude(driver, state.Gps ? state.Gps.altitude : NaN);

  var barometer = state.Barometer || {};
  drawTemp(driver, barometer.temperature, barometer.pressure);
}

var mapSize = [64, 75];
var mapOffsets = [1, 43]
var mapOffsetY = mapOffsets[1];
var bounds = {
  width: mapSize[0] - 4,
  height: mapSize[1] - 4,
  zoom: 1
};

var drawMapDebounced = _.debounce(drawMap, 1000);

function drawMap(driver, path) {
  console.log('OverviewDisplay:drawMap');
  drawMapCanvas(driver);
  if (!path || !path.points || path.points.length === 0) {
    // empty
    var lineSize = 14;
    var x1 = mapOffsets[0] + mapSize[0] / 2 - lineSize / 2 - 2;
    var y1 = mapOffsets[1] + mapSize[1] / 2 - lineSize / 2 - 2;
    driver.drawLine(x1, y1, x1 + lineSize, y1 + lineSize, 1);
    // driver.drawLine(x1, y1 + lineSize, x1 + lineSize, y1, 1);
    // driver.fillRect(x1 + lineSize / 4, y1 + lineSize / 4, lineSize / 2 + 1, lineSize / 2 + 1, 0);
    driver.drawCircle(x1 + lineSize / 2, y1 + lineSize / 2, lineSize / 2, lineSize / 2, 1);
    return;
  }

  var pathPoints = path.points;
  var initialCoord = pathPoints[0];
  initBounds(bounds, initialCoord);

  renderWholePath(driver, pathPoints, mapOffsets);
}

function drawMapCanvas(driver) {
  driver.fillRect(0, mapOffsetY - 1, mapSize[0], mapSize[1] + 2, 0);
  var filter = DottedFilter(driver);
  driver.drawRect(0, mapOffsetY - 1, mapSize[0], mapSize[1] + 2, 1);
  filter.dispose();
}

var outCounter = 0;
function drawMapPoint(driver, value, stateStore) {

  var coord = [value.latitude, value.longitude];
  if (!bounds.lonLeft) {
    initBounds(bounds, coord);
  }

  var pixel = getPixelCoordinate(coord, bounds);
  if (
    pixel.x > mapSize[0] || pixel.y > mapSize[1] ||
    pixel.x < 0 || pixel.y < 0) {
    // relocate
    // console.log('..out!')
    outCounter++;
    if (outCounter > 5) {
      outCounter = 0;
      var state = stateStore.getState();
      drawMapDebounced(driver, state.Path);
      // drawMapCanvas(driver);
      // renderWholePath(driver, state.Path.points, mapOffsets);
    }

    return;
  }


  // var filter = NoisyFilter(driver);
  driver.drawPixel(
    pixel.x + mapOffsets[0],
    pixel.y + mapOffsets[1],
    1);
  // filter.dispose();

}

function drawSpeed(driver, speed) {
  driver.setCursor(0, 6);
  driver.setTextSize(2);

  if (isNaN(speed)) {
    write(driver, '-.-');
  } else {
    var s = toFixed(mpsToKph(speed), 1);
    write(driver, s);
  }
}

function drawTemp(driver, temp, pressure) {
  driver.fillRect(0, 24, 64, 18, 0);

  driver.setTextSize(1);
  if (temp) {
    driver.setCursor(0, 24);
    write(driver, temp + ' C');
  }

  if (pressure) {
    driver.setCursor(0, 33);
    var pressureLabel = (Math.round(pressure * 10) / 10) + ' Pa';
    write(driver, pressureLabel);
  }
}

function drawAltitude(driver, altitude) {
  // var altText = !isNaN(altitude) ? (toFixed(altitude, 1)  + ' m') : '-';
  // driver.setCursor(4, 24);
  // driver.setTextSize(1);
  // write(driver, 'A:' + altText);
}

function drawTime(driver, ticks) {
  var totalTicks = ticks && ticks.length ? ticks[0] : 0;
  var elapsed = Math.round(totalTicks / 1000);
  var sTime = formatTime(elapsed);

  driver.setTextColor(1, 0);
  driver.setCursor(0, height - 8);
  driver.setTextSize(1);
  write(driver, sTime);
}

function drawDistance(driver, distance) {
  distance = distance || 0;
  driver.setTextColor(1, 0);
  var text = toFixed(distance, 2);

  // right align
  var minX = 34;
  var x = mapSize[1] - ((text.length - 1) * 10 + 5);
  x = x < minX ? minX : x;
  driver.setCursor(x, height - 8);

  driver.setTextSize(1);
  write(driver, text);
}

function write(driver, string) {
  var chars = string.split('');
  chars.forEach((c) => {
    driver.write(c.charCodeAt(0));
  });
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

const mpsToKph = (mps) => Math.round(mps * 3.6 * 100) / 100;

function formatTime(ticks) {
  if (isNaN(ticks)) return '--:--';
  var hh = Math.floor(ticks / 3600);
  var mm = Math.floor((ticks % 3600) / 60);

  return pad(hh, 2) + ':' + pad(mm, 2);
}

function pad(n, width) {
  var n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
}

// maps stuff
function renderWholePath(driver, path, offsets) {
  if (!path || path.length == 0) return;

  offsets = offsets || [0, 0];

  var lowLongitude = _.minBy(path, (s) => s[1])[1];
  var maxLongitude = _.maxBy(path, (s) => s[1])[1];
  var latitude = _.minBy(path, (s) => s[0])[0];

  // zoom on last point only
  if (bounds.zoom > 1) {
    var last = _.last(path);
    lowLongitude = last[1] - 0.01 / bounds.zoom;
    maxLongitude = last[1] + 0.01 / bounds.zoom;
    latitude = last[0] - 0.02 / bounds.zoom;
  }

  var lonDelta = maxLongitude - lowLongitude;

  bounds.lonLeft = lowLongitude;
  bounds.lonDelta = lonDelta;
  bounds.latBottomDegree = latitude * Math.PI / 180;

  // TODO: prioritize and delay rendering of each point
  // TODO: save in 'buffer' each pixel and dont 'redraw' existing pixels
  // var filter = NoisyFilter(driver);  
  path.forEach((coord) => {
    var pixel = getPixelCoordinate(coord, bounds);

    var isOut = pixel.x > mapSize[0] || pixel.y > mapSize[1] ||
      pixel.x < 0 || pixel.y < 0;

    if (isOut) {
      return;
    }

    driver.drawPixel(pixel.x + offsets[0], pixel.y + offsets[1], 1);
  });
  // filter.dispose();
}

// graph functions
function getPixelCoordinate(coord, bounds) {

  var point = convertGeoToPixel(
    coord[0], coord[1],
    bounds.width,
    bounds.height,
    bounds.lonLeft,
    bounds.lonDelta,
    bounds.latBottomDegree);

  var x = Math.round(point.x);
  var y = Math.round(point.y);

  return { x: x, y: y };
}

function initBounds(bounds, initialCoord) {
  bounds.zoom = 1;
  bounds.lonLeft = initialCoord[1] - 0.01;
  bounds.lonDelta = 0.02;
  bounds.latBottomDegree = (initialCoord[0] - 0.02) * Math.PI / 180;
}

function convertGeoToPixel(latitude, longitude,
  mapWidth, // in pixels
  mapHeight, // in pixels
  mapLonLeft, // in degrees
  mapLonDelta, // in degrees (mapLonRight - mapLonLeft);
  mapLatBottomDegree) // in Radians
{
  var x = (longitude - mapLonLeft) * (mapWidth / mapLonDelta);

  latitude = latitude * Math.PI / 180;
  var worldMapWidth = ((mapWidth / mapLonDelta) * 360) / (2 * Math.PI);
  var mapOffsetY = (worldMapWidth / 2 * Math.log((1 + Math.sin(mapLatBottomDegree)) / (1 - Math.sin(mapLatBottomDegree))));
  var y = mapHeight - ((worldMapWidth / 2 * Math.log((1 + Math.sin(latitude)) / (1 - Math.sin(latitude)))) - mapOffsetY);

  return { x: x, y: y };
}

function zoom(driver, stateStore) {
  // abort/return false if path is unexistint
  console.log('zoom', bounds);
  var state = stateStore.getState();
  if (state && state.Path && state.Path.points) {
    bounds.zoom += 1;
    if (bounds.zoom > 5) bounds.zoom = 1;

    // driver.clear();
    drawMapCanvas(driver);
    renderWholePath(driver, state.Path.points, mapOffsets);
  }
}