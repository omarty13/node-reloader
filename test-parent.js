'use strict';

const NodeReloader		= require("./index.js");


console.log("------------------------------------------------------------");

// Create instance of NodeReloader
let nodeReloader = new NodeReloader({
	scriptPath: __dirname + "/test-child.js",
	args: [],
	watch: [
		__dirname + "/*.js",
	],
	ignore: [
		//__dirname + "/start_server.js",
	],
	stdio: [ process.stdin, process.stdout, process.stderr, 'ipc'],
	restartTimeout: 2000,
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
	setTimeout(() => {
		console.log("Try start from parent...");

		process.send({
			message: "parent -> child",
			counter: 0,
		});
	}, 500);
});

