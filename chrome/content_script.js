// Runs in the isolated world: relays events from injected.js (MAIN world) to the background.
document.addEventListener('postMessageTracker', function(event) {
	try {
		var detail = event.detail;
		if (typeof detail === 'string') detail = JSON.parse(detail);
		chrome.runtime.sendMessage(detail);
	} catch (e) {
		// extension context invalidated (extension reloaded) or bad payload
	}
});

// separate fragment changes from real location changes
window.addEventListener('beforeunload', function() {
	try {
		chrome.runtime.sendMessage({ changePage: true });
	} catch (e) {}
});
