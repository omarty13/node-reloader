import { watch }                           from 'node:fs';
import fsPromises                          from 'node:fs/promises';
import path                                from 'node:path';
import EventEmitter                        from "events";
import child_process                       from "child_process";

const __dirname = path.dirname(import.meta.url.replace(/^file:\/\/\//, ""));


export class NodeReloader extends EventEmitter
{
	constructor(config)
	{
		super();

		this._scriptPath = config.scriptPath;
		this._isDebug = config.isDebug || false;
		this._args = (config.args == undefined) ? ([]) : (config.args);
		this._autostart = (config.autostart == undefined) ? (true) : (config.autostart);
		this._restartTimeout = (typeof config.restartTimeout == "number") ? (config.restartTimeout) : (3000);
		this._watcherDelay = (typeof config.watcherDelay == "number") ? (config.watcherDelay) : (1000);
		this._stdio = (config.stdio) ? (config.stdio) : ([ process.stdin, process.stdout, process.stderr, ]);

		this.state = "STOPPED";
		this.process = null;
		this._restartTimer = null;
		this._watchTbl = new Set();
		this._watcherArr = [];

		this._dirWatchTbl = this._makeDirs({
			watch: config.watch,
			ignore: config.ignore,
		});

		this._consoleLog("__________ this._dirWatchTbl _______________________________");
		this._consoleLog(this._dirWatchTbl);

		if (this._autostart == true) {
			this.start();
		}
	}

	/**
	 * Function for logging in debug mode.
	 */
	_consoleLog(/* arguments */) {
		if (this._isDebug) console.log(...arguments);
	}

	/**
	 * Function for creating dirs to watch.
	 * @param {Object} { watch, ignore, } - Parameters watch and ignore paths.
	 * @return {Object} Returns dirsWatchTbl like:
	 * 	{
	 *			"c:/dev/server": { reWatchArr: [ <RegExp>, .., ], reIgnoreArr: [ <RegExp>, .., ], },
	 *			"c:/dev/client": { reWatchArr: [ <RegExp>, .., ], reIgnoreArr: [ <RegExp>, .., ], },
	 *		}
	 */
	_makeDirs({ watch, ignore, }) {
		const dirWatchTbl = {};

		for (let i = 0; i < watch.length; i++) {
			const glob = watch[i];
			const indx = glob.search(/\/[^\/]*(\*|\?)/);

			if (indx > -1) {
				const dir = glob.substring(0, indx);
				const re = this._globToRE(glob);

				if (dirWatchTbl[dir] == undefined) {
					dirWatchTbl[dir] = { needCheckFile: false, reWatchArr: [ re, ], reIgnoreArr: [], };
				} else {
					dirWatchTbl[dir].reWatchArr.push(re);
				}
			}
			else {
				const dir = glob.replace(/\/$/, "");
				const re = new RegExp(dir +"/.*");

				dirWatchTbl[dir] = { needCheckFile: true, reWatchArr: [ re, ], reIgnoreArr: [], };
			}
		}

		for (let i = 0; i < ignore.length; i++) {
			const glob = ignore[i];
			const indx = glob.search(/\/[^\/]*\*/);

			if (indx > -1) {
				const dir = glob.substring(0, indx);
				const re = this._globToRE(glob);

				if (dirWatchTbl[dir]) {
					dirWatchTbl[dir].reIgnoreArr.push(re);
				}
			}
			else {
				const dir = glob.replace(/\/$/, "");
				const re = new RegExp(dir +"/.*");

				if (dirWatchTbl[dir]) {
					dirWatchTbl[dir].reIgnoreArr.push(re);
				}
			}
		}

		return dirWatchTbl;
	}

	/**
	 * Function for creating RE from glob.
	 * @param {String} dirstr - Glob string.
	 * @return {RegExp} Returns Regular Expression.
	 */
	_globToRE(dirstr) {
		const arr = dirstr.split("/");
		
		for (let i = 0; i < arr.length; i++) {
			const indx = arr[i].search(/\*\*/g);

			// .replace(/\./g, "\\."); // This replace first! ⚠️
			if (indx > -1) {
				arr[i] = arr[i].replace(/\./g, "\\.").replace(/\*\*/g, ".*").replace(/\?/g, ".");
			}
			else {
				arr[i] = arr[i].replace(/\./g, "\\.").replace(/\*/g, "[^\/]*").replace(/\?/g, ".");
			}
		}
		
		console.log(arr.join("/") + "$");
		return new RegExp(arr.join("/") + "$");
	}
	
	/**
	 * Start NodeReloader.
	 */
	start() {
		if (this.process != null) {
			console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] start : already started "${this._scriptPath}"`);
			return;
		}

		this.state = "STARTING";

		this._start();
	}

	/**
	 * Stop NodeReloader.
	 */
	stop() {
		if (this.process == null) {
			console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] stop : not started "${this._scriptPath}"`);
			return;
		}

		this.state = "STOPPING";
		
		while (this._watcherArr.length > 0) {
			const watcher = this._watcherArr.pop();
			watcher.close();
		}
		
		this.process.kill();
		this.process = null;
	}

	/**
	 * Restart NodeReloader.
	 */
	restart() {
		this._restart();
	}

	/**
	 * Inner start function.
	 */
	_start() {
		console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] _start : start process "${this._scriptPath}"`);

		if (this._restartTimer != null) {
			clearTimeout(this._restartTimer);
		}

		var args = [this._scriptPath].concat(this._args);
		var spawnOptns = { stdio: this._stdio, };
		// var spawnOptns = { stdio: [ process.stdin, process.stdout, process.stderr, 'ipc'], };
		// var spawnOptns = { stdio: [ "pipe", "pipe", "pipe", ], };

		this.process = child_process.spawn("node", args, spawnOptns);

		this.process.on("spawn", () => {
			console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] this.process.on "spawn" : process has spawned successfully "${this._scriptPath}"`);

			if (this._watcherArr.length == 0) {
				setTimeout(() => this._createWatchers(), this._watcherDelay);
			}

			this.emit("spawn", this);
		});

		this.process.on("error", (err) => {
			console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] this.process.on "error" : error process "${this._scriptPath}" ${err}`);
		});
		
		this.process.on("close", (code) => {
			console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] this.process.on "close" : close process "${this._scriptPath}" with code ${code}`);
			
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
			}, this._restartTimeout);
		});

		this.state = "STARTED";
	}

	/**
	 * Inner restart function.
	 */
	_restart() {
		console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] _restart : restart process "${this._scriptPath}", this.process.exitCode ${this.process.exitCode}`);

		if (this.state == "RESTARTING") {
			return;
		}

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
	async _createWatchers() {
		console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] _createWatcher`);

		const pathnamesToWatch = [];

		for (const _dir in this._dirWatchTbl) {
			const watchDir = this._dirWatchTbl[_dir];
			let stat;
			
			if (watchDir.needCheckFile === true) {
				try {
					stat = await fsPromises.stat(_dir);
				}
				catch(err) {
					if (err.code == "ENOENT") {
						continue;
					} else {
						throw err;
					}
				}

				if (stat.isFile()) {
					pathnamesToWatch.push(_dir);
				}
				else if (stat.isDirectory()) {
					const { dir, base, } = path.parse(_dir);
					pathnamesToWatch.push(...await this._getFiles(dir, base, watchDir.reWatchArr, watchDir.reIgnoreArr));
				}
				else {
					console.warn(`Path "${_dir}" is not a file or directory.`);
				}
			}
			else {
				const { dir, base, } = path.parse(_dir);
				pathnamesToWatch.push(...await this._getFiles(dir, base, watchDir.reWatchArr, watchDir.reIgnoreArr));
			}
		}

		this._consoleLog("__________ pathnamesToWatch ________________________________");
		this._consoleLog(pathnamesToWatch);

		for (let i = 0; i < pathnamesToWatch.length; i++) {
			const pathname = pathnamesToWatch[i];

			const watcher = watch(pathname, (eventType, filename) => {
				const watchId = `${eventType}:${filename}`;

				if (this._watchTbl.has(watchId) == true) {
					return;
				}
				else {
					this._watchTbl.add(watchId);
					setTimeout(() => this._watchTbl.delete(watchId), 200);
				}

				console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] watch : event ${eventType}, file "${filename}" - ${pathname}`);

				if (this.state != "STARTED") {
					return;
				}

				this.state = "RESTART_DELAY";
				
				this._waitTimer = setTimeout(() => {
					this._restart();
				}, 200);
			});

			this._watcherArr.push(watcher);
		}
	}

	/**
	 * Inner function for get files.
	 * @param {*} pathParent
	 * @param {*} dirname
	 * @return {*} 
	 */
	async _getFiles(pathParent, dirname, reWatchArr, reIgnoreArr) {
		const pathCurrent = `${pathParent}/${dirname}`;
		const dirList = await fsPromises.readdir(pathCurrent, { withFileTypes: true, });
		const rsltList = [];

		loopStart:
		for (let i = 0; i < dirList.length; i++) {
			const dir = `${pathCurrent}/${dirList[i].name}`;
			// this._consoleLog("___debug___ dir -", dir);

			if (dirList[i].isDirectory() == true) {
				rsltList.push(...await this._getFiles(pathCurrent, dirList[i].name, reWatchArr, reIgnoreArr));
				continue;
			}

			if (dirList[i].isFile() == false) {
				continue;
			}

			for (let ii = 0; ii < reIgnoreArr.length; ii++) {
				// this._consoleLog("___debug___ ignore -", reIgnoreArr[ii].test(dir), dir);
				if (reIgnoreArr[ii].test(dir) == true) {
					continue loopStart;
				}
			}

			for (let ii = 0; ii < reWatchArr.length; ii++) {
				// this._consoleLog("___debug___ watch -", reWatchArr[ii].test(dir), dir);
				if (reWatchArr[ii].test(dir) == true) {
					rsltList.push(dir);
				}
			}		
		}

		return rsltList;
	}
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










