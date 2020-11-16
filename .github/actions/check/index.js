const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

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
  const html = await fetch(
    'https://vmkartingcenter.nimenhuuto.com/events'
  ).then((response) => response.text());

  const $ = cheerio.load(html);

  return $('.event-detailed-container')
    .toArray()
    .map((container) => {
      const date = `${$('.event-detailed-date', container).text()}.${
        MONTHS[$('.event-month', container).text()]
      }.`;

      const match = $(container)
        .text()
        .match(/Ilmoittautumiset:.*?(\d+) \/ (\d+)/);

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

const getData = async (id) => {
  try {
    const data = await fs.readFile(`data/${id}`);
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
};

const storeData = async (id, data) => {
  await fs.writeFile(`data/${id}`, JSON.stringify(data, null, 2));
};

const checkEvent = async (event) => {
  const data = await getData(event.id);

  if (!data) {
    await storeData(event.id, {
      ...event,
      hasBeenFull: event.participants >= event.total,
    });
    return;
  }
};

(async () => {
  (await getEvents()).forEach(checkEvent);
})();
