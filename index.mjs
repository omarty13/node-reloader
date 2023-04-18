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
		this._spawnOptions = config.spawnOptions;
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

		this._regexpTbl = this._makeRegexpTbl({
			watch: config.watch,
			ignore: config.ignore,
		});

		this._consoleLog("__________ this._regexpTbl _______________________________");
		this._consoleLog(this._regexpTbl);

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
	 *			"watchPaths": Set() { 'c:/Dev/node-reloader/dir-to-test', },
	 *			"watchGlobs": Map() { regexp.toString() => regexp },
	 *			"ignoreGlobs": Map() { regexp.toString() => regexp },
	 *		}
	 */
	_makeRegexpTbl({ watch, ignore, }) {
		const watchPaths = new Set();
		const watchGlobs = new Map();
		const ignoreGlobs = new Map();

		const reGlobSearch = /\/[^\/]*(\*|\?)/;

		for (let i = 0; i < watch.length; i++) {
			const glob = watch[i].replace(/\/$/, "");
			const indx = glob.search(reGlobSearch);

			if (indx > -1) {
				const dir = glob.substring(0, indx);
				watchPaths.add(dir);

				const re = this._globToRegexp(glob);
				watchGlobs.set(re.toString(), re);
			}
			else {
				const dir = glob;
				watchPaths.add(dir);

				const re = this._globToRegexp(glob, { isRealPath: true, });
				watchGlobs.set(re.toString(), re);
			}
		}

		for (let i = 0; i < ignore.length; i++) {
			const glob = ignore[i].replace(/\/$/, "");
			const indx = glob.search(reGlobSearch);

			if (indx > -1) {
				const re = this._globToRegexp(glob);
				ignoreGlobs.set(re.toString(), re);
			}
			else {
				const re = this._globToRegexp(glob, { isRealPath: true, });
				ignoreGlobs.set(re.toString(), re);
			}
		}

		return {
			watchPaths,
			watchGlobs,
			ignoreGlobs,
		};
	}

	/**
	 * Function for creating RE from glob.
	 * @param {String} dirstr - Glob string.
	 * @return {RegExp} Returns Regular Expression.
	 */
	_globToRegexp(dirstr, options = { isRealPath: false, }) {
		const arr = dirstr.split("/");
		
		for (let i = 0; i < arr.length; i++) {
			const indx = arr[i].search(/\*\*/g);

			if (indx > -1) {
				arr[i] = arr[i]
					.replace(/\./g, "\\.") // This replace first! ⚠️
					// .replace(/\[/g, "\\[")
					// .replace(/\]/g, "\\]")
					.replace(/\*\*/g, ".*")
					.replace(/\?/g, ".");
			}
			else {
				arr[i] = arr[i]
					.replace(/\./g, "\\.") // This replace first! ⚠️
					// .replace(/\[/g, "\\[")
					// .replace(/\]/g, "\\]")
					.replace(/\*/g, "[^\\/]*")
					.replace(/\?/g, ".");
			}
		}

		if (options.isRealPath == false) {
			return new RegExp("^"+ arr.join("/") +"$");
		} else {
			return new RegExp("^"+ arr.join("/") +"([\\/].+|$)");
		}
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

		const args = [this._scriptPath].concat(this._args);
		// const spawnOptns = Object.assign({ stdio: this._stdio, }, this._spawnOptions);
		// const spawnOptns = { stdio: [ process.stdin, process.stdout, process.stderr, 'ipc'], };
		// const spawnOptns = { stdio: [ "pipe", "pipe", "pipe", ], };

		this.process = child_process.spawn("node", args, this._spawnOptions);

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

		const { watchPaths,
			     watchGlobs,
			     ignoreGlobs, } = this._regexpTbl;

		const watchPathsArr = Array.from(watchPaths);
		const watchGlobsArr = Array.from(watchGlobs.values());
		const ignoreGlobsArr = Array.from(ignoreGlobs.values());
		const pathnamesToWatch = [];

		for (let i = 0; i < watchPathsArr.length; i++) {
			pathnamesToWatch.push(...await this._getFiles(watchPathsArr[i], watchGlobsArr, ignoreGlobsArr));
		}

		// -----------------------------------------------------------------

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
	 * @param {String} pathCrnt - Current path.
	 * @param {Array} watchGlobsArr - Array with globs for watching.
	 * @param {Array} ignoreGlobsArr - Array with globs for ignoring.
	 * @return {*} 
	 */
	 async _getFiles(pathCrnt, watchGlobsArr, ignoreGlobsArr) {
		// console.log(`[${createTimestamp()}] [sys  ] [NodeReloader] _getFiles`, pathCrnt);

		let stat;
		try {
			stat = await fsPromises.stat(pathCrnt);
		}
		catch(err) {
			if (err.code == "ENOENT") {
				return [];
			} else {
				throw err;
			}
		}

		if (stat.isFile()) {
			// this._consoleLog("___debug___ file -", pathCrnt);

			for (let i = 0; i < ignoreGlobsArr.length; i++) {
				// console.log("___ FILE IGNR", ignoreGlobsArr[i]);
				if (ignoreGlobsArr[i].test(pathCrnt) == true) {
					return [];
				}
			}

			for (let i = 0; i < watchGlobsArr.length; i++) {
				// console.log("___ FILE WTCH", watchGlobsArr[i]);
				if (watchGlobsArr[i].test(pathCrnt) == true) {
					return [ pathCrnt, ];
				}	
			}

			return [];
		}
		else if (stat.isDirectory()) {
			for (let i = 0; i < ignoreGlobsArr.length; i++) {
				// console.log("___ DIR IGNR", ignoreGlobsArr[i]);
				if (ignoreGlobsArr[i].test(pathCrnt) == true) {
					return [];
				}
			}

			const pathnamesToWatch = [];
			const dirArr = await fsPromises.readdir(pathCrnt, /* { withFileTypes: true, } */);
			
			for (let i = 0; i < dirArr.length; i++) {
				pathnamesToWatch.push(...await this._getFiles(`${pathCrnt}/${dirArr[i]}`, watchGlobsArr, ignoreGlobsArr));
			}

			return pathnamesToWatch;
		}
		else {
			console.warn(`Path "${pathCrnt}" is not a file or directory.`);
			return [];
		}
	}
}

/**
 * Create timestamp.
 * @returns {string} Returns timestamp in string view.
 */
function createTimestamp() {
	const date = new Date();

	const day = String(date.getDate());
	const month = String(date.getMonth() + 1);
	const year = date.getFullYear();
	const hours = String(date.getHours());
	const minutes = String(date.getMinutes());
	const seconds = String(date.getSeconds());
	let millisec = String(date.getUTCMilliseconds());
	
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