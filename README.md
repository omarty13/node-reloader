# node-reloader

**Node Reloader** was created for convenient start of child process
and its restart in case of failure or change of source files.
This is version without any dependencies. Only native node modules.

## Install

```
npm install @omarty13/node-reloader
```

## Parameters

* `scriptPath` {string} - Full path of the script.
* `spawnOptions` {Object} - Spawn options.
	*	`cwd` {String} | {URL} Current working directory of the child process.
	*	`env` {Object} Environment key-value pairs. Default: process.env.
	*	`argv0` {String} Explicitly set the value of argv[0] sent to the child process. This will be set to command if not specified.
	*	`stdio` {Array} | {String} Child's stdio configuration (see options.stdio).
	*	`detached` {Boolean} Prepare child to run independently of its parent process. Specific behavior depends on the platform, see options.detached).
	*	`uid` {Number} Sets the user identity of the process (see setuid(2)).
	*	`gid` {Number} Sets the group identity of the process (see setgid(2)).
	*	`serialization` {String} Specify the kind of serialization used for sending messages between processes. Possible values are 'json' and 'advanced'. See Advanced serialization for more details. Default: 'json'.
	*	`shell` {Boolean} | {String} If true, runs command inside of a shell. Uses '/bin/sh' on Unix, and process.env.ComSpec on Windows. A different shell can be specified as a string. See Shell requirements and Default Windows shell. Default: false (no shell).
	*	`windowsVerbatimArguments` {Boolean} No quoting or escaping of arguments is done on Windows. Ignored on Unix. This is set to true automatically when shell is specified and is CMD. Default: false.
	*	`windowsHide` {Boolean} Hide the subprocess console window that would normally be created on Windows systems. Default: false.
	*	`signal` {AbortSignal} allows aborting the child process using an AbortSignal.
	*	`timeout` {Number} In milliseconds the maximum amount of time the process is allowed to run. Default: undefined.
	*	`killSignal` {String} | {integer} The signal value to be used when the spawned process will be killed by timeout or abort signal. Default: 'SIGTERM'.
* `watch` {Array} - Watch changes in files for reload child process. File, dir, glob.
* `ignore` {Array} - Optional. File/paths ignored for watching. File, dir, glob.
* `args` {string[]} - Optional. Arguments for execution script.
* `autostart` {boolean} - Optional. Autostart after creating Nodereloader. Default **true**.
* `restartTimeout` {number} - Optional. Restart timeout (milliseconds) after shutdown process with error. Default 3000 ms.
* `watcherDelay` {number} - Optional. The delay (milliseconds) between successful spawn the process and creating the watcher after. Default 1000 ms.
* `stdio` {Array} - Optional. Parameter stdio for spawn options is passed to the child process. Default is *[ process.stdin, process.stdout, process.stderr, ]*.

## Functions

### `start()`
* Start NodeReloader. Use for manual start then `autostart` parameter set in `false`.

### `stop()`
* Stop NodeReloader.

### `restart()`
* Restart NodeReloader.

## Example of use

```javascript
import NodeReloader from '@omarty13/node-reloader';

const __dirname = path.dirname(import.meta.url.replace(/^file:\/\/\//, ""));


let nodeReloader = new NodeReloader({
	// Path to the node.js
	nodePath: "node", // By default is "node", but can be used for example - "c:/Program Files/nodejs/node.exe"
	// Path of the script
	scriptPath: __dirname + "/app-test.js",
	// Spawn options
	spawnOptions: {
		stdio: [ process.stdin, process.stdout, process.stderr, 'ipc', ],
		// cwd: __dirname +"/src",
		// ...
	},
	// Delay before watch
	watcherDelay: 0,
	// Arguments for pass to process
	args: [
		// `--base-dir=${"BASEDIR"}`,
	],
	// Watch changes in files for reload child process
	watch: [
		__dirname + "/dir-to-test/**/*-?.mjs",
		__dirname + "/dir-to-test/*.json",
	],
	// Ignore changes in files
	ignore: [
		// __dirname + "/dir-to-test/*.js",
	],
	// Autostart of watching (Default: true)
	autostart: true,
	// Delay before restart  (Default: 3000)
	restartTimeout: 5000,
});
```
