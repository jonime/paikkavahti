"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = __importDefault(require("node-fetch"));
const cheerio_1 = __importDefault(require("cheerio"));
const fs_1 = require("fs");
const core_1 = __importDefault(require("@actions/core"));
const MONTHS = {
    TAMMI: 1,
    HELMI: 2,
    MAALIS: 3,
    HUHTI: 4,
    TOUKO: 5,
    KESÄ: 6,
    HEINÄ: 7,
    ELO: 8,
    SYYS: 9,
    LOKA: 10,
    MARRAS: 11,
    JOULU: 12,
};
const getEvents = async () => {
    const html = await node_fetch_1.default('https://vmkartingcenter.nimenhuuto.com/events').then((response) => response.text());
    const $ = cheerio_1.default.load(html);
    return $('.event-detailed-container')
        .toArray()
        .map((container) => {
        const date = `${$('.event-detailed-date', container).text()}.${MONTHS[$('.event-month', container).text()]}.`;
        const match = $(container)
            .text()
            .match(/Ilmoittautumiset:.*?(\d+) \/ (\d+)/);
        if (!match) {
            throw new Error('Invalid content');
        }
        const link = $('a', container).prop('href');
        const [, id] = link.match(/\/(\d+)$/);
        const participants = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        return {
            id,
            date,
            participants,
            total,
            link,
        };
    });
};
const getEvent = async (id) => {
    try {
        const data = await fs_1.promises.readFile(`data/${id}`);
        return JSON.parse(data.toString());
    }
    catch (e) {
        return null;
    }
};
const storeEvent = async (event) => {
    try {
        await fs_1.promises.writeFile(`data/${event.id}`, JSON.stringify(event, null, 2));
    }
    catch (e) {
        console.error(`Couldn't write data/${event.id} file`);
    }
};
const sendSlackMessage = async (text) => {
    await node_fetch_1.default(core_1.default.getInput('slack-webhook'), {
        method: 'POST',
        body: JSON.stringify({
            text,
        }),
        headers: { 'Content-Type': 'application/json' },
    });
};
const checkEvent = async (event) => {
    const lastEventData = await getEvent(event.id);
    await storeEvent(event);
    if (!lastEventData) {
        return;
    }
    const isFull = event.participants >= event.total;
    const hasBeenFull = lastEventData.participants >= lastEventData.total;
    if (hasBeenFull && !isFull) {
        await sendSlackMessage(`<@joni> Nyt olis tilaa ${event.date} kisaan! (${event.participants}/${event.total}) ${event.link}`);
    }
};
(async () => {
    (await getEvents()).forEach(checkEvent);
})();
