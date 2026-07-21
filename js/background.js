let mainTabId = 0;

chrome.runtime.onMessage.addListener(
	async function (request, sender, sendResponse) {

		//Creates a new tab with the url sent in request
		if (request.action == "openTab") {
			chrome.tabs.create({ url: request.url, active: true });
			sendResponse({ text: 'OK' })
		}

		//Switches tab to the request tab id
		if (request.action == "focusMe") {
			var updateProperties = { 'active': true };
			chrome.tabs.update(sender.tab.id, updateProperties, (tab) => { });
			sendResponse({ text: 'OK' })
		}

		//Closes the request tab id
		if (request.action == "closeMe") {
			chrome.tabs.remove(sender.tab.id)
		}

		//Keeping track of tabs by using an array that stores their id
		if (request.action == "registerTab") {
			addTabData(sender.tab.id, request.total)
			sendResponse({ text: 'OK' })
		}

		//Clears the tab id array
		if (request.action == "clearTabs") {
			setTabData(new Array())
			sendResponse({ text: 'OK' })
		}

		//Ordering tabs by Total Price
		if (request.action == "orderTabs") {

			let tabData = await getTabData;

			tabData.sort(function (a, b) {
				return a.total - b.total;
			});

			for await (const [i, t] of tabData.entries()) {
				try {
					await chrome.tabs.move(t.tabId, { index: i + 1 });
				} catch {
				}
			}

			sendResponse({ text: 'OK' })
		}

		return true;
	});

//Keeping track of tabs by using an array that stores their id
async function addTabData(tabId, total) {
	let tabData = await getTabData;
	tabData.push({ tabId: tabId, total: total })
	setTabData(tabData)
}

//Getting the tab array info from storage
let getTabData = new Promise((resolve) => {
	chrome.storage.local.get('tabData', function (result) {
		if (result.tabData === undefined) {
			resolve(new Array())
		} else {
			resolve(result.tabData)
		}
	});
})

//Setting the tab array info to storage
function setTabData(tabData) {
	chrome.storage.local.set({ tabData: tabData }, function () {
	});
}