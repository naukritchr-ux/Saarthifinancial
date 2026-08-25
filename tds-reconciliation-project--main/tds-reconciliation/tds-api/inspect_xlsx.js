import xlsx from 'xlsx';
import path from 'path';

try {
  const filePath = path.resolve('TDS Mearge Data 2019-2024.xlsx');
  console.log('Reading file:', filePath);
  const workbook = xlsx.readFile(filePath);
  
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    console.log(`\nSheet: "${sheetName}" | Total Rows: ${rawData.length}`);
    if (rawData.length > 0) {
      console.log('Sample Rows (first 5):');
      rawData.slice(0, 5).forEach((row, idx) => {
        console.log(`  Row ${idx}:`, JSON.stringify(row));
      });
    }
  });
} catch (err) {
  console.error('Error reading xlsx:', err);
}
