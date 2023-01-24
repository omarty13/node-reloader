
// setInterval(() => {
// 	console.log("_____ hello world __________________________________________");
// }, 10 * 1000);

process.on("message", (message) => {
	console.log("On child:", message);

	setTimeout(() => {
		process.send({ message: "child -> parent", counter: ++message.counter, })
	}, 500);
});
