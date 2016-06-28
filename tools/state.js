var _ = require('lodash');
var Rx = require('rxjs');
var State = require('../app/state');
var Persistence = require('../app/persistence');
var Replay = require('../app/replay_sensors');

var dbFilePath = process.argv[2];
if (!dbFilePath) throw new Error('no path to .sqlite!');

// load path
var db = new Persistence(dbFilePath, true);
var replay = Replay(db.readSensors(), false);

var state = State.FromStream(replay).share();
state.last()
    .subscribe(console.log);


state.count()
    .subscribe(console.log);