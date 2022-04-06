"use strict";

var util                                = require("util");
var EventEmitter                        = require("events");
var child_process                       = require('child_process');
var chokidar                            = require("chokidar");


util.inherits(NodeReloader, EventEmitter);

module.exports = NodeReloader;

/**
 * NodeReloader constructor.
 *
 * @constructor
 * @param {object} config - Configuration object.
 * @param {string} config.scriptPath - Full path to script.
 * @param {string[]} config.watch - File/paths for watching. File, dir, glob, or array.
 * @param {string[]} [config.args=[]] - Arguments for execution script.
 * @param {boolean} [config.autostart=true] - Autostart after creating NodeReloader.
 * @param {number} [config.restartTimeout=3000] - Restart timeout (milliseconds) after shutdown process with error.
 * @param {number} [config.watcherDelay=1000] - The delay (milliseconds) between successful spawn the process and creating the watcher after.
 * @param {string[]} [config.ignore=[]] - File/paths ignored for watching.
 * @param {boolean} [config.stdio] - Parameter stdio for spawn options is passed to the child process. Default is [ process.stdin, process.stdout, process.stderr, ].
 */

function NodeReloader(config)
{
	EventEmitter.apply(this, arguments);

	this._config = config;

	this._config.args = (this._config.args == undefined) ? ([]) : (this._config.args);
	this._config.autostart = (this._config.autostart == undefined) ? (true) : (this._config.autostart);
	this._config.restartTimeout = (typeof this._config.restartTimeout == "number") ? (this._config.restartTimeout) : (3000);
	this._config.watcherDelay = (typeof this._config.watcherDelay == "number") ? (this._config.watcherDelay) : (1000);
	this._config.ignore = (this._config.ignore == undefined) ? ([]) : (this._config.ignore);
	this._config.stdio = (this._config.stdio) ? (this._config.stdio) : ([ process.stdin, process.stdout, process.stderr, ]);

	this.state = "STOPPED";
	this.process = null;
	this._restartTimer = null;
	this._watcher = null;

	if (this._config.autostart == true) {
		this.start();
	}
}

/**
 * Start NodeReloader.
 */
NodeReloader.prototype.start = function() {
	if (this.process != null) {
		console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] start : already started "${this._config.scriptPath}"`);
		return;
	}

	this.state = "STARTING";

	this._start();
}

/**
 * Stop NodeReloader.
 */
NodeReloader.prototype.stop = function() {
	if (this.process == null) {
		console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] stop : not started "${this._config.scriptPath}"`);
		return;
	}

	this.state = "STOPPING";
	
	this._watcher.close();
	this._watcher = null;
	
	this.process.kill();
	this.process = null;
}

/**
 * Restart NodeReloader.
 */
NodeReloader.prototype.restart = function() {
	this._restart();
}

/**
 * Inner start function.
 */
NodeReloader.prototype._start = function() {
	console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] _start : start process "${this._config.scriptPath}"`);

	if (this._restartTimer != null) {
		clearTimeout(this._restartTimer);
	}

	var args = [this._config.scriptPath].concat(this._config.args);
	var spawnOptns = { stdio: this._config.stdio, };
	// var spawnOptns = { stdio: [ process.stdin, process.stdout, process.stderr, 'ipc'], };
	// var spawnOptns = { stdio: [ "pipe", "pipe", "pipe", ], };

	this.process = child_process.spawn("node", args, spawnOptns);

	this.state = "STARTED";

	this.process.on("spawn", () => {
		console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] this.process.on "spawn" : process has spawned successfully "${this._config.scriptPath}"`);

		if (this._watcher == null) {
			setTimeout(() => this._createWatcher(), this._config.watcherDelay);
		}

		this.emit("spawn", this);
	});

	this.process.on("error", (err) => {
		console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] this.process.on "error" : error process "${this._config.scriptPath}" ${err}`);
	});
	
	this.process.on("close", (code) => {
		console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] this.process.on "close" : close process "${this._config.scriptPath}" with code ${code}`);
		
		if (this.state == "STOPPING") {
			this.state = "STOPPED";
			return;
		}
		if (this.state == "RESTARTING") {
			this._start();
			return;
		}

		this.state = "CLOSED";
		
		this._restartTimer = setTimeout(() => {
			this._restartTimer = null;
			this._start();
		}, this._config.restartTimeout);
	});
}

/**
 * Inner restart function.
 */
NodeReloader.prototype._restart = function() {
	console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] _restart : restart process "${this._config.scriptPath}"`);

	if (this.process.exitCode === null) {
		this.state = "RESTARTING";
		this.process.kill();
	}
	else {
		this._start();
	}
}

/**
 * Inner function to create watcher.
 */
NodeReloader.prototype._createWatcher = function() {
	console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] _createWatcher`);

	this._watcher = chokidar.watch(this._config.watch, {
		ignored: this._config.ignore,
		persistent: true
	});

	this._watcher.on('change', (path, stats) => {
		if (stats) {
			console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] this._watcher.on change : file "${path}" changed size to ${stats.size}`);
		}

		this._restart();
	});
}

/**
 * Create timestamp.
 * @returns {string} Returns timestamp in string view.
 */
function createTimestamp() {
	var date = new Date();

	var day = String(date.getDate());
	var month = String(date.getMonth() + 1);
	var year = date.getFullYear();
	var hours = String(date.getHours());
	var minutes = String(date.getMinutes());
	var seconds = String(date.getSeconds());
	var millisec = String(date.getUTCMilliseconds());
	
	if (millisec.length == 2) millisec = "0" + millisec;
	else if (millisec.length == 1) millisec = "00" + millisec;

	return (
		((day.length < 2) ? ("0"+day) : (day)) +
		"-" +
		((month.length < 2) ? ("0"+month) : (month)) +
		"-" +
		year +
		" " +
		((hours.length < 2) ? ("0"+hours) : (hours)) +
		":" +
		((minutes.length < 2) ? ("0"+minutes) : (minutes)) +
		":" +
		((seconds.length < 2) ? ("0"+seconds) : (seconds)) +
		"." +
		millisec
	)
}
