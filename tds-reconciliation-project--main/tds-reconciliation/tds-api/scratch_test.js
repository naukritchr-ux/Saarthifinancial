import db from './config/db.js';
import { getCleaningQueue, getCleaningQueueCount } from './controllers/tds26as/reports.js';

async function run() {
  const req = { query: {} };
  const resCount = {
    json: (data) => console.log('getCleaningQueueCount RESPONSE:', data),
    status: (code) => ({ json: (d) => console.log('ERROR:', code, d) })
  };
  await getCleaningQueueCount(req, resCount);

  const resQueue = {
    json: (data) => console.log('getCleaningQueue RESPONSE: totalCount =', data.count, 'data length =', data.data?.length),
    status: (code) => ({ json: (d) => console.log('ERROR:', code, d) })
  };
  await getCleaningQueue(req, resQueue);

  process.exit(0);
}

run();
