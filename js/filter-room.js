let filterSettings = null
let waitCounter = 0
let closing = false
let tempSettings = localStorage.getItem('filterSettings')

if (tempSettings) {
    filterSettings = JSON.parse(tempSettings)
}

const delay = millis => new Promise((resolve, reject) => {
    setTimeout(_ => resolve(), millis)
});

setTimeout(() => {
    runFilters()
}, 2000);

//Checking the custom filters in the page
async function runFilters() {

    if (filterSettings.isRunning) {
        
        //waiting for Amenities button to load
        await waitForAmenitiesButton()
        //Getting the Total Price
        checkForPriceInfo()
        //Checking for Fast Internet
        HighlightFastInternet()

        if (filterSettings.kingBed) {
            //Checking for King Sized Bed
            checkForBedInfo()
        }

        if (filterSettings.fastInternet) {
            //Checking for King Sized Bed
            checkFastInternet()
        }

        if (closing)
            return;


        if (filterSettings.dishWasher || filterSettings.contentText.length > 0) {
            let amenitiesButton = document.querySelector('[data-section-id="AMENITIES_DEFAULT"] button')

            if (amenitiesButton) {
                amenitiesButton.click()
                await delay(3000)

                if (filterSettings.dishWasher) {
                    //Checking for Dish Washer
                    checkForDishWasherInfo()
                }

                if (closing)
                    return;


                if (filterSettings.contentText.length > 0) {
                    //Checking for Text
                    checkForContentText()
                }

                if (closing)
                    return;

                document.querySelector('[aria-label="Close"]').click()
            }
        }
    }
}

//waiting for Amenities button to load
async function waitForAmenitiesButton() {

    while (true) {
        await delay(1000)
        let amenitiesButton = document.querySelector('[data-section-id="AMENITIES_DEFAULT"] button')

        waitCounter++

        if (amenitiesButton) {
            break;
        }

        if (waitCounter == 10) {
            break;
        }
    }

    return true;
}

function callClose(reason) {
    //document.querySelector('[aria-label="Airbnb Homepage"]').innerHTML = reason;   
    closing = true
    chrome.runtime.sendMessage({ action: "closeMe", }, function (response) {
    })
}

setInterval(() => {
    //If window title wasn't already changed, it will get price and set the title to <PRICE + TITLE>
    if (document.title.match(/\d+: /) == null) {
        let price = getPrice()
        if (price > 0) {
            document.title = price + ": " + document.title
        }
    }
}, 1000);

//Gets the TOTAL price
function getPrice() {
    let spans = document.querySelectorAll('[data-section-id="BOOK_IT_SIDEBAR"] span')

    if (spans) {
        let lastSpan = spans[spans.length - 2]
        let text = lastSpan.textContent

        if (text.match(/\d+/g)) {
            let total = parseInt(text.match(/\d+/g).join(''))
            return total
        }
    }

    return 0
}

//Gets the TOTAL price and registers the tab
function checkForPriceInfo() {    
    let total = getPrice()

    if (total > 0) {
        chrome.runtime.sendMessage({ action: "registerTab", total: total }, function (response) {
        })
    }
}

//Checking for King Sized Bed
function checkForBedInfo() {
    let bedInfoElement = document.querySelector('[data-section-id*="SLEEPING_ARRANGEMENT"]')

    if (bedInfoElement) {
        if (bedInfoElement.textContent.match(/king bed/i) == null) {
            callClose('king bed')
        }
    }
}

//Checking for Text
function checkForContentText() {
    let regex = new RegExp(filterSettings.contentText, 'i');
    let found = false
    let elements = document.querySelectorAll('div[data-section-id]')

    if (elements.length > 10) {
        for (i = 0; i < 10; i++) {
            let el = elements[i]
            if (el.textContent.match(regex)) {
                found = true
            }
        }
    }

    if (!found) {
        callClose('content text')
    }
}

//Checking for Dish Washer
function checkForDishWasherInfo() {
    let regex = new RegExp('dishwasher', 'i');
    if (document.body.textContent.match(regex) == null) {
        callClose('dishwasher')
    }
}

//Highlight Fast Internet
function HighlightFastInternet() {
    let highlightsElement = document.querySelector('[data-section-id="HIGHLIGHTS_DEFAULT"]')

    if (highlightsElement) {

        highlightsElement.innerHTML = highlightsElement.innerHTML.replace('Fast wifi', '<span style="background: yellow">Fast wifi</span>')

        highlightsElement.innerHTML = highlightsElement.innerHTML.replace('wifi that’s well-suited for working', '<span style="background: yellow">wifi that’s well-suited for working</span>')

        highlightsElement.innerHTML = highlightsElement.innerHTML.replace('Dedicated workspace', '<span style="background: yellow">Dedicated workspace</span>')

        highlightsElement.innerHTML = highlightsElement.innerHTML.replace('dedicated workspace', '<span style="background: yellow">dedicated workspace</span>')

        highlightsElement.scrollIntoView()
    }
}

// Checking for Fast Internet
function checkFastInternet() {
    let highlightsElement = document.querySelector('[data-section-id="HIGHLIGHTS_DEFAULT"]');

    if (highlightsElement) {
        let termsToCheck = [
            'Fast wifi',
            'wifi that’s well-suited for working',
            'Dedicated workspace',
            'dedicated workspace'
        ];

        let found = termsToCheck.some(term => highlightsElement.innerHTML.includes(term));

        if (!found) {
            callClose('Fast Internet')
        }

        highlightsElement.scrollIntoView();
    }
}
