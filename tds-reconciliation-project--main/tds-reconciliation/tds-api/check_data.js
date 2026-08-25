import db from './config/db.js';

const check = async () => {
  try {
    const [columns] = await db.execute('DESCRIBE tds_tally_entries');
    console.log('Columns of tds_tally_entries:', columns);
  } catch (err) {
    console.error('❌ Error describing tds_tally_entries:', err);
  } finally {
    await db.close();
  }
};

check();
