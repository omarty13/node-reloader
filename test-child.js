'use strict';


console.log("------------------------------------------------------------");

// Set event on message, for receive message from parent process (test.js)
process.on("message", (message) => {
	console.log("On child:", message);

	setTimeout(() => {
		process.send({ message: "child -> parent", counter: ++message.counter, })
	}, 500);
});

// process.on('uncaughtException', (err) => {
	
// });

setTimeout(() => {
	throw new Error("Artificially caused error");
}, 3000);




