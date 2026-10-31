let tab_listeners = {};
let tab_push = {}, tab_lasturl = {};
let selectedId = -1;

// restore state after the service worker wakes up
const ready = chrome.storage.session.get(['tab_listeners', 'tab_push', 'tab_lasturl', 'selectedId'])
	.then(function(s) {
		tab_listeners = s.tab_listeners || {};
		tab_push = s.tab_push || {};
		tab_lasturl = s.tab_lasturl || {};
		if (typeof s.selectedId === 'number') selectedId = s.selectedId;
	})
	.catch(function() {});

function saveState() {
	chrome.storage.session.set({ tab_listeners, tab_push, tab_lasturl, selectedId }).catch(function() {});
}

function refreshCount() {
	if (selectedId < 0) return;
	const tabId = selectedId;
	const txt = tab_listeners[tabId] ? tab_listeners[tabId].length : 0;
	chrome.tabs.get(tabId, function() {
		if (chrome.runtime.lastError) return;
		chrome.action.setBadgeText({ text: '' + txt, tabId: tabId }).catch(function() {});
		chrome.action.setBadgeBackgroundColor({
			color: txt > 0 ? [255, 0, 0, 255] : [0, 0, 255, 0]
		}).catch(function() {});
	});
}

function logListener(data) {
	chrome.storage.sync.get({ log_url: '' }, function(items) {
		const log_url = items.log_url;
		if (!log_url.length) return;
		fetch(log_url, {
			method: 'post',
			headers: { "Content-type": "application/json; charset=UTF-8" },
			body: JSON.stringify(data)
		}).catch(function() {});
	});
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	ready.then(function() {
		if (!sender.tab) return;
		const tabId = sender.tab.id;
		if (msg.listener) {
			if (msg.listener == 'function () { [native code] }') return;
			msg.parent_url = sender.tab.url;
			if (!tab_listeners[tabId]) tab_listeners[tabId] = [];
			tab_listeners[tabId].push(msg);
			logListener(msg);
		}
		if (msg.pushState) {
			tab_push[tabId] = true;
		}
		if (msg.changePage) {
			delete tab_lasturl[tabId];
		}
		saveState();
		if (msg.log) {
			console.log(msg.log);
		} else {
			refreshCount();
		}
	});
});

chrome.tabs.onUpdated.addListener(function(tabId, props) {
	ready.then(function() {
		if (props.status == "complete") {
			if (tabId == selectedId) refreshCount();
		} else if (props.status) {
			if (tab_push[tabId]) {
				// this was a pushState, ignore
				delete tab_push[tabId];
			} else if (!tab_lasturl[tabId]) {
				// wipe on other statuses, but only if changePage did not run
				tab_listeners[tabId] = [];
			}
		}
		if (props.status == "loading") tab_lasturl[tabId] = true;
		saveState();
	});
});

chrome.tabs.onActivated.addListener(function(activeInfo) {
	ready.then(function() {
		selectedId = activeInfo.tabId;
		saveState();
		refreshCount();
	});
});

chrome.tabs.onRemoved.addListener(function(tabId) {
	ready.then(function() {
		delete tab_listeners[tabId];
		delete tab_push[tabId];
		delete tab_lasturl[tabId];
		saveState();
	});
});

chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
	if (tabs && tabs[0]) {
		ready.then(function() {
			selectedId = tabs[0].id;
			saveState();
			refreshCount();
		});
	}
});

chrome.runtime.onConnect.addListener(function(port) {
	port.onMessage.addListener(function(msg) {
		ready.then(function() {
			port.postMessage({ listeners: tab_listeners });
		});
	});
});
