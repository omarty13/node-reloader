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
	// Path of the script
	scriptPath: __dirname + "/app-test.js",
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
	// Spawn options
	stdio: [ process.stdin, process.stdout, process.stderr, 'ipc', ],
});
```
