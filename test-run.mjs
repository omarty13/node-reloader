import path                             from 'node:path';
// import { watch }                        from 'node:fs';
import { NodeReloader }                 from "./index.mjs";

const __dirname = path.dirname(import.meta.url.replace(/^file:\/\/\//, ""));


let nodeReloader = new NodeReloader({
	scriptPath: __dirname + "/test-app.js",
	spawnOptions: {
		stdio: [ process.stdin, process.stdout, process.stderr, 'ipc', ],
	},
	watcherDelay: 0,
	isDebug: true,
	args: [
		// `--base-dir=${"BASEDIR"}`,
	],
	watch: [
		// __dirname + "/dir-to-test/**/*-?.mjs",
		// __dirname + "/dir-to-test/**/*.json",
		// __dirname + "/dir-to-test/**/*-[^a-b].mjs",
		// __dirname + "/app-tes?.js",
		// __dirname + "/dir-to-test/**",
		// __dirname + "/dir-to-test/file-1.mjs",
		__dirname + "/dir-to-test",
		// __dirname + "/node_modules/**/*",
		// "./dir-to-test/**/*",
	],
	ignore: [
		// __dirname + "/dir-to-test/file-no",
		// __dirname + "/dir-to-test/",
		// __dirname + "/dir-to-test/",
	],
	restartTimeout: 5000,
});


nodeReloader.on("spawn", ({ process, }) => {
	// Set event on message, for receive message from child process (test-app.js)
	process.on("message", (message) => {
		console.log("On parent:", message);

		setTimeout(() => {
			process.send({
				message: "parent -> child",
				counter: ++message.counter,
			});
		}, 500);
	});

	// Set interval of send message to child process
	// setTimeout(() => {
	// 	console.log("Try start from parent...");

	// 	process.send({
	// 		message: "parent -> child",
	// 		counter: 0,
	// 	});
	// }, 500);
});
