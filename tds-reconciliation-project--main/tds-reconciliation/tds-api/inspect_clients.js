import db from './config/db.js';

const check = async () => {
  try {
    // 1. Check if clients_info exists
    const [tables] = await db.execute(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients_info'
    `);
    
    if (tables.length === 0) {
      console.log('❌ clients_info table does not exist in the database.');
      return;
    }

    console.log('✅ clients_info table exists.');
    
    // Describe table
    const [columns] = await db.execute('DESCRIBE clients_info');
    console.log('Columns of clients_info:', columns.map(c => `${c.Field} (${c.Type})`));

    // Get count
    const [countRes] = await db.execute('SELECT COUNT(*) as count FROM clients_info');
    console.log('Total records in clients_info:', countRes[0].count);

    // Sample records
    const [samples] = await db.execute('SELECT * FROM clients_info LIMIT 5');
    console.log('Sample clients_info records:', samples);

  } catch (err) {
    console.error('❌ Error checking clients_info:', err);
  } finally {
    await db.close();
  }
};

check();
