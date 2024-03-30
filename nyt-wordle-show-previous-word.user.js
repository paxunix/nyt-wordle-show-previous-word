// ==UserScript==
// @name        Wordle - show yesterday's word
// @description Shows yesterday's word on the current wordle puzzle so it's easier to play ultra-hard mode.
// @match       https://www.nytimes.com/games/wordle/*
// @version     4
// @downloadURL https://raw.githubusercontent.com/paxunix/nyt-wordle-show-previous-word/main/nyt-wordle-show-previous-word.user.js
// @updateURL   https://raw.githubusercontent.com/paxunix/nyt-wordle-show-previous-word/main/nyt-wordle-show-previous-word.user.js
// @author      paxunix@gmail.com
// @grant       GM.xmlHttpRequest
// @grant       GM.setValue
// @grant       GM.getValue
// @grant       GM.addStyle
// @require     https://cdn.jsdelivr.net/gh/paxunix/WaitForElements@v20231207.1/WaitForElements.min.js
// ==/UserScript==

/* jshint esversion:11 */
/* globals GM */

const previousWordsUrl = "https://wordfinder.yourdictionary.com/wordle/answers/";

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


function localISODate(date)
{
    return [date.getFullYear(), new String(date.getMonth() + 1).padStart(2, "0"), new String(date.getDate()).padStart(2, "0")].join("-");
}


async function getPreviousWordleWords()
{
    "use strict";

    let now = new Date();

    // Read from cached words.  If we have yesterday's word, use it,
    // otherwise update cache.
    let data = (await GM.getValue("previousWordleWords")) ?? null;
    if (data !== null)
    {
        let yesterday = localISODate(new Date((new Date()).getTime() - 86400000));

        if (data.words[0].date === yesterday)
            return data.words;
    }

    let doc = (await fetcher({url: previousWordsUrl, responseType: "document" })).response;
    let rows = Array.from(doc.querySelectorAll('tr'))
        .filter(tr => {
            let el = tr.querySelector('td:nth-child(3)');
            return el ? el.innerText.search(/^\s*\w+\s*$/) !== -1 : false;
        });

    if (rows.length === 0)
        throw "Failed to find previous word list.  Selector needs updating?";

    let words = rows.map(tr => {
        let h2 = tr.closest("table")?.previousElementSibling;
        if (h2.nodeName !== "H2")
            throw new Error("Can't find expected h2");

        let year = h2.innerText.match(/(\d+)/)[0];

        let [date, number, word] = Array.from(tr.querySelectorAll("td")).map(td => td.textContent?.trim() ?? "");

        date = (new Date(`${date} ${year}`)).toISOString().split("T")[0];
        number = parseInt(number, 10);
        word = word.toUpperCase();

        return {
            date,
            number,
            word,
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
        left: 15vw;
        top: 15vh;
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

    let yesterday = localISODate(new Date((new Date()).getTime() - 86400000));
    let allWords = await getPreviousWordleWords();
    let yesterdayWordData = allWords.filter(wd => wd.date === yesterday)[0] ?? null;
    let yesterdayWord = "<unknown>";

    if (yesterdayWordData !== null)
        yesterdayWord = yesterdayWordData.word;

    let $tbl = document.createElement("table");
    $tbl.id = "nyt-wordle-show-previous-word";
    $tbl.innerHTML = `<tr style="border: 2px dotted grey"><th>Yesterday's Word (<a id="_wordlelisturl"><span id="_yesterdaydate"></span></a>)</th></tr><tr style="border: 2px dotted grey"><td id="_yesterdayWord"></td></tr>`;
    let $word = $tbl.querySelector("#_yesterdayWord");
    $word.innerText = yesterdayWord;
    let $atag = $tbl.querySelector("#_wordlelisturl");
    $atag.href = previousWordsUrl;
    let $yesterday = $tbl.querySelector("#_yesterdaydate");
    $yesterday.innerText = yesterday;

    let waiter = new WaitForElements({ selectors: ["div[data-testid=game-wrapper]" ] });
    let $els = await waiter.match();

    $els[0].insertAdjacentElement("beforeend", $tbl);
}

main();
