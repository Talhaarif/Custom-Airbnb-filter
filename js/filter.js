let stopRequested = false;
let tabCount = 0;
let customFilterBtn;
let spinnerUrl = '';
fetch(chrome.runtime.getURL("/media/spinner.gif")).then(resp => spinnerUrl = resp.url)

//Default Settings
let filterSettings = {
    version: 1.5,
    isRunning: false,
    maxTabs: 20,
    minRating: 4.8,
    minVotes: 10,
    kingBed: true,
    dishWasher: true,
    fastInternet: true,
    contentText: '',
    minDelay: 3,
    maxDelay: 6
}

const delay = millis => new Promise((resolve, reject) => {
    setTimeout(_ => resolve(), millis)
});

function randomIntFromInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min)
}

function saveSettings() {
    filterSettings.maxTabs = parseInt(filterMaxTabs.value)
    filterSettings.minRating = parseFloat(filterMinRating.value)
    filterSettings.minVotes = parseInt(filterMinVotes.value)
    filterSettings.kingBed = filterKingBed.checked
    filterSettings.dishWasher = filterDishWasher.checked
    filterSettings.fastInternet = filterFastInternet.checked
    filterSettings.minDelay = parseInt(filterMinDelay.value)
    filterSettings.maxDelay = parseInt(filterMaxDelay.value)
    filterSettings.contentText = filterContentText.value
    localStorage.setItem('filterSettings', JSON.stringify(filterSettings))
}

function loadSettings() {
    let tempSettings = localStorage.getItem('filterSettings')

    if (tempSettings) {
        tempSettings = JSON.parse(tempSettings)

        if (tempSettings.version == filterSettings.version) {
            filterSettings = tempSettings
            filterMaxTabs.value = filterSettings.maxTabs
            filterMinRating.value = filterSettings.minRating
            filterMinVotes.value = filterSettings.minVotes
            filterKingBed.checked = filterSettings.kingBed
            filterDishWasher.checked = filterSettings.dishWasher
            filterFastInternet.checked = filterSettings.fastInternet
            filterMinDelay.value = filterSettings.minDelay
            filterMaxDelay.value = filterSettings.maxDelay
            filterContentText.value = filterSettings.contentText
        }
    }
}

addOptionsModal()

setInterval(() => {
    addCustomFilterButtonIfMissing()
}, 2000)

//Injecting Options Modal
function addOptionsModal() {
    fetch(chrome.runtime.getURL("/html/filter.html"))
        .then(resp => resp.text())
        .then(html => {
            document.body.insertAdjacentHTML('beforeend', html)

            $(document).on('click', '#customFilterStart', () => {
                $('#customFilterStart').hide()
                $('#customFilterStop').show()
                $('#customFilterModal').modal('hide')
                
                saveSettings()
                mainLoop();
            })

            $(document).on('click', '#customFilterStop', () => {
                endProcess('Stopped by user.')
            })
        })
}


function addCustomFilterButtonIfMissing() {
    if ($('#customFilterBtn').length) {
        return
    }

    //Adds the custom filter if the default filter is found on page    
    let filterBtn = $('[style*="--filter-button"]')//let filterBtn = $('[data-section-id="EXPLORE_STRUCTURED_PAGE_TITLE"] button')

    if (filterBtn) {
        let svg = `<svg id="filterIconSvg" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="display:block;height:16px;width:16px;fill:currentColor" aria-hidden="true" role="presentation" focusable="false"><path d="M5 8c1.306 0 2.418.835 2.83 2H14v2H7.829A3.001 3.001 0 1 1 5 8zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6-8a3 3 0 1 1-2.829 4H2V4h6.17A3.001 3.001 0 0 1 11 2zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"></path></svg>`
        let spinner = `<img id="filterSpinner" width="16" height="16" style="display: none" src=${spinnerUrl}></img>`
        customFilterBtn = document.createElement('button')
        $(customFilterBtn).attr('id', 'customFilterBtn')
        $(customFilterBtn).html(`<span style="display:flex; align-items: center; margin: 2px 10px">${spinner}${svg}<span>Custom Filter</span></span>`)

        $(customFilterBtn).on('click', () => {
            $('#customFilterModal').modal('show')
        })

        filterBtn.before(customFilterBtn)
        loadSettings()
    }
}

async function mainLoop() {
    stopRequested = false
    tabCount = 0
    filterSettings.isRunning = true

    chrome.runtime.sendMessage({ action: "clearTabs" }, function (response) {
    })

    //Display spinner.gif
    $('#filterSpinner').show();

    while (!stopRequested) {
        saveSettings()

        //Gets the listings found on page
        // let listings = document.querySelectorAll('[itemprop="itemListElement"]')

        let h2Elements = document.querySelectorAll('h2');
        let targetH2;

        for (let h2 of h2Elements) {
        if (h2.textContent.trim() === "Available for similar dates") {
        targetH2 = h2;
        break;
        }
        }

        let allListings = Array.from(document.querySelectorAll('[itemprop="itemListElement"]'));
        let listings = [];

        if(targetH2)
        {
            for (const target_listing of allListings) {
                if (target_listing.compareDocumentPosition(targetH2) & Node.DOCUMENT_POSITION_FOLLOWING) {
                    listings.push(target_listing);
                } else {
                break; // Once we reach listings after the h2, we can break out of the loop
                }
                }
        }
        else
        {
            listings = allListings;
        }


        if(listings.length == 0) {
            await delay(5000)
            endProcess('No other listings found.')
            break;
        }

        //For each listing found it gets the information and then opens a tab to apply the custom filters
        for await (const listing of listings) {
            let infoNodes = listing.querySelectorAll('[aria-label*="5 average rating"]')

            if (infoNodes.length == 0)
                continue;

            let infoText = infoNodes[infoNodes.length - 1].textContent
            let ratingMatch = infoText.match(/\d\.\d+/)
            let votesMatch = infoText.match(/\(\d+\)/)

            //Something is wrong if both of these are missing
            if (ratingMatch.length == 0 && votesMatch.length == 0)
                continue;

            let ratingMatchValue = ratingMatch[0]
            let rating = parseFloat(ratingMatchValue)
            let votesMatchValue = votesMatch[0].match(/\d+/)[0]
            let votes = parseInt(votesMatchValue)

            if (rating < filterSettings.minRating)
                continue;

            if (votes < filterSettings.minVotes)
                continue;

            let url = listing.querySelector('a').getAttribute('href')

            if(url.includes('split-stays'))
                continue;
            
            //Sends message to background to open this listing in a new tab
            chrome.runtime.sendMessage({ action: "openTab", url: `https://www.airbnb.com/${url}` }, function (response) {
            })

            let randomSleepInt = randomIntFromInterval(filterSettings.minDelay, filterSettings.maxDelay)
            await delay(randomSleepInt * 1000)

            //Stop if Max Tabs have been reached
            tabCount++
            if (tabCount >= filterSettings.maxTabs) {

                //wait for tabs to load before setting isRunning to false
                await delay(5000)
                endProcess('Max Tabs Reached.')
                break;
            }

            if (stopRequested) {
                //wait for tabs to load before setting isRunning to false
                await delay(5000)
                break
            }
        }

        //Sends message to background to focus on this Tab
        chrome.runtime.sendMessage({ action: "focusMe" })

        await delay(3000)

        //Getting Next Page anchor and clicking if it exists
        let nextPageElement = document.querySelector('a[aria-label="Next"]')

        if (nextPageElement) {
            if (nextPageElement.hasAttribute('disabled')) {
                await delay(5000)
                endProcess('No More Pages.')
                break
            }
            else {
                if (stopRequested == false) {
                    nextPageElement.click();
                    let loaded = await checkListingsLoaded()
                }
            }
        } else {
            endProcess('No More Pages.')
        }

        //await delay(7500)
    }
}

function endProcess(message) {
    stopRequested = true
    filterSettings.isRunning = false
    saveSettings()
    $('#customFilterStart').show()
    $('#customFilterStop').hide()
    $('#filterSpinner').hide();

    //Sends message to background to order the tabs by total price
    chrome.runtime.sendMessage({ action: "orderTabs"}, function (response) {
        if (message) {
            alert(message)
        }
    
        let pageOne = document.querySelector('[aria-label="Previous"]').nextSibling;
        if (pageOne) {
            pageOne.click();
        }
    })
}

//Waiting for listings to load
async function checkListingsLoaded() {
    let counter = 0;
    let loaded = false;

    //check for 20s
    while (counter < 20) {
        let listings = document.querySelectorAll('[itemprop="itemListElement"]')

        if (listings.length > 0) {
            loaded = true
            break
        }

        counter++
        await delay(1000)
    }

    await delay(3000)

    return loaded;
}

