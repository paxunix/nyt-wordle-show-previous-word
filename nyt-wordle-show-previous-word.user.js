// ==UserScript==
// @name        Wordle - show previous puzzle's word
// @description Shows previous puzzle's word on the current wordle puzzle so it's easier to play ultra-hard mode.
// @match       https://www.nytimes.com/games/wordle/*
// @version     5
// @downloadURL https://raw.githubusercontent.com/paxunix/nyt-wordle-show-previous-word/main/nyt-wordle-show-previous-word.user.js
// @updateURL   https://raw.githubusercontent.com/paxunix/nyt-wordle-show-previous-word/main/nyt-wordle-show-previous-word.user.js
// @author      paxunix@gmail.com
// @grant       GM.xmlHttpRequest
// @grant       GM.setValue
// @grant       GM.getValue
// @grant       GM.addStyle
// @require     https://cdn.jsdelivr.net/gh/paxunix/WaitForElements/WaitForElements.min.js
// ==/UserScript==

/* jshint esversion:11 */
/* globals GM */

const previousWordsUrl = "https://wordfinder.yourdictionary.com/wordle/answers/";

// Can now do previous wordles, so detect if a date is present as the last part of the URL pathname.
// If not, use today's date.
const curPuzzleDate = ((window.location.pathname.split("/").pop().match(/^(\d\d\d\d-\d\d-\d\d)$/) ?? []))[1] ??
    localISODate(new Date());

// Must append time otherwise the date is off, likely due to timezone difference between local and UTC
const prevPuzzleDate = localISODate(new Date(((new Date(`${curPuzzleDate}T00:00:00`)).getTime() - 86400000)));


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

    // Read from cached words.  If we have the previous word, use it,
    // otherwise update cache.
    let data = (await GM.getValue("previousWordleWords")) ?? null;
    if (data !== null)
    {
        if (data.words[0].date === prevPuzzleDate)
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

    let allWords = await getPreviousWordleWords();
    let prevWordData = allWords.filter(wd => wd.date === prevPuzzleDate)[0] ?? null;
    let prevWord = "<unknown>";

    if (prevWordData !== null)
        prevWord = prevWordData.word;

    let $tbl = document.createElement("table");
    $tbl.id = "nyt-wordle-show-previous-word";
    $tbl.innerHTML = `<tr style="border: 2px dotted grey"><th>Previous Word (<a id="_wordlelisturl"><span id="_prevdate"></span></a>)</th></tr><tr style="border: 2px dotted grey"><td id="_prevWord"></td></tr>`;
    let $word = $tbl.querySelector("#_prevWord");
    $word.innerText = prevWord;
    let $atag = $tbl.querySelector("#_wordlelisturl");
    $atag.href = previousWordsUrl;
    let $prevDate = $tbl.querySelector("#_prevdate");
    $prevDate.innerText = prevPuzzleDate;

    let waiter = new WaitForElements({ selectors: ["div[data-testid=game-wrapper]" ] });
    let $els = await waiter.match();

    $els[0].insertAdjacentElement("beforeend", $tbl);
}

main();
