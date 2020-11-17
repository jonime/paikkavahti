import fetch from 'node-fetch';
import cheerio from 'cheerio';
import { promises as fs } from 'fs';
import core from '@actions/core';

interface EventData {
  id: string;
  date: string;
  link: string;
  participants: number;
  total: number;
}

const MONTHS: Record<string, number> = {
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

const getEvent = async (id: string): Promise<EventData | null> => {
  try {
    const data = await fs.readFile(`data/${id}`);
    return JSON.parse(data.toString());
  } catch (e) {
    return null;
  }
};

const storeEvent = async (event: EventData) => {
  try {
    await fs.writeFile(`data/${event.id}`, JSON.stringify(event, null, 2));
  } catch (e) {
    console.error(`Couldn't write data/${event.id} file`);
  }
};

const sendSlackMessage = async (text: string) => {
  await fetch(core.getInput('slack-webhook'), {
    method: 'POST',
    body: JSON.stringify({
      text,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
};

const checkEvent = async (event: EventData) => {
  const lastEventData = await getEvent(event.id);
  await storeEvent(event);

  if (!lastEventData) {
    return;
  }

  const isFull = event.participants >= event.total;
  const hasBeenFull = lastEventData.participants >= lastEventData.total;

  if (hasBeenFull && !isFull) {
    await sendSlackMessage(
      `<@joni> Nyt olis tilaa ${event.date} kisaan! (${event.participants}/${event.total}) ${event.link}`
    );
  }
};

(async () => {
  (await getEvents()).forEach(checkEvent);
})();
