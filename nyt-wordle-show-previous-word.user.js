// ==UserScript==
// @name        Wordle - show yesterday's word
// @description Shows yesterday's word on the current wordle puzzle so it's easier to play ultra-hard mode.
// @match       https://www.nytimes.com/games/wordle/*
// @version     1
// @author      paxunix@gmail.com
// @grant       GM.xmlHttpRequest
// @grant       GM.setValue
// @grant       GM.getValue
// @grant       GM.addStyle
// ==/UserScript==

/* jshint esversion:11 */
/* globals GM */


function fetcher(opts)
{
    "use strict";

    return new Promise((res, rej) => {
        opts.headers = opts.headers || {};
        opts.headers.Accept = opts.headers.Accept || "*/*";
        opts.method = opts.method || "GET";
        opts.onload = response => {
            if (response.status >= 200 && response.status < 300)
            {
                res(response);
            }
            else
            {
                rej({
                    status: response.status,
                    statusText: `${response.statusText} retrieving ${opts.url}`
                });
            }
        };
        opts.onerror = response => {
            rej({
                status: response.status,
                statusText: `${response.statusText} retrieving ${opts.url}`
            });

        };

        return GM.xmlHttpRequest(opts);
    });
}


async function getPreviousWordleWords()
{
    "use strict";

    // Read from cached words, cache TTL is 15 hours
    let data = (await GM.getValue("previousWordleWords")) ?? null;
    if (data !== null)
    {
       if (Date.now() <= data.retrievedTime + (15 * 60 * 60 * 1000))
           return data.words;
    }

    let doc = (await fetcher({url: "https://www.fiveforks.com/wordle/", responseType: "document" })).response;

    let $chronoWordList = Array.from(doc.querySelectorAll("div > strong")).filter(el => el.textContent.includes("Chronological"))[0]?.closest("div") ?? null;

    if ($chronoWordList === null)
        throw "Failed to find previous word list";

    let words = $chronoWordList.textContent.matchAll(/([a-z]+)\s+#(\d+)\s+(\d\d)\/(\d\d)\/(\d\d)/gi);
    words = [...words].map(r => {
        return {
            word: r[1],
            number: r[2],
            date: `20${r[5]}/${r[3]}/${r[4]}`,
        }
    });

    // order from newest to oldest
    words.sort((a, b) => b.date.localeCompare(a.date, "en-US"));

    GM.setValue("previousWordleWords", {
        retrievedTime: Date.now(),
        words: words
    });

    return words;
}


async function main()
{
    GM.addStyle(`
table#nyt-wordle-show-previous-word {
        position: absolute;
        left: 20vw;
        top: 20vh;
        z-index: 1000;
        border-color: grey;
        border-width: 2px;
        border-style: dotted;
        text-align: center;
        color: grey;
        font-weight: bold;
}

table#nyt-wordle-show-previous-word td, table#nyt-wordle-show-previous-word th {
    padding: 1ex;
}

`);

    let yesterdayWordData = (await getPreviousWordleWords())[0];
    let yesterdayWord = yesterdayWordData?.word ?? null;

    if (yesterdayWord === null)
        throw "Yesterday's word not found";

    let $tbl = document.createElement("table");
    $tbl.id = "nyt-wordle-show-previous-word";
    $tbl.innerHTML = `<tr style="border: 2px dotted grey"><th>Yesterday's Word (${yesterdayWordData.date})</th></tr><tr style="border: 2px dotted grey"><td id="_yesterdayWord"></td></tr>`;
    $word = $tbl.querySelector("#_yesterdayWord");
    $word.innerText = yesterdayWord;

    document.body.insertAdjacentElement("beforeend", $tbl);
}

main();
