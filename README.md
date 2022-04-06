# node-reloader

**Node Reloader** was created for convenient start of child process
and its restart in case of failure or change of source files.
Based on chokidar.

## Install

```
npm install @omarty13/node-reloader
```

## Parameters

* `scriptPath` {string} - Full path of the script.
* `watch` {string[]} - File/paths for watching. File, dir, glob, or array.
* `args` {string[]} - Optional. Arguments for execution script.
* `autostart` {boolean} - Optional. Autostart after creating Nodereloader. Default **true**.
* `restartTimeout` {number} - Optional. Restart timeout (milliseconds) after shutdown process with error. Default 3000 ms.
* `watcherDelay` {number} - Optional. The delay (milliseconds) between successful spawn the process and creating the watcher after. Default 1000 ms.
* `ignore` {string[]} - Optional. File/paths ignored for watching.
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
const NodeReloader = require("@omarty/node-reloader");

// Create instance of NodeReloader
let nodeReloader = new NodeReloader({

  // Path of the script
  scriptPath: __dirname + "/test-app.js",
  
  // Arguments for pass to process
  args: [                                   
    "--dev-mode",
    "--log-level=trace",
  ],
  
  // Watch changes in files for reload child process
  watch: [
    __dirname + "/*.js",
  ],
  
  // Ignore changes in files
  ignore: [
	  //__dirname + "/start_server.js",
  ],
  
  stdio: [ process.stdin, process.stdout, process.stderr, 'ipc'],
  restartTimeout: 2000,
  
});
```
