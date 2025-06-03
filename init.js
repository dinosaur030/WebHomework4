// === init.js ===
// FRED 匯率 CSV 匯入 SQLite

const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser'); // 確保有安裝 npm install csv-parser

const db = new sqlite3.Database('./exchange_rates.db');

// 建立資料表
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE,
      rate REAL
    )
  `);
});

const CSV_URL = 'https://fred.stlouisfed.org/series/DEXTAUS/downloaddata/DEXTAUS.csv';
const CSV_FILE = path.join(__dirname, 'DEXTAUS.csv');

async function downloadCSV() {
  const response = await axios.get(CSV_URL, { responseType: 'stream' });
  const writer = fs.createWriteStream(CSV_FILE);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function importCSVtoDB() {
  await downloadCSV();
  console.log('CSV 下載完成！開始匯入...');

  const stmt = db.prepare('INSERT OR IGNORE INTO exchange_rates (date, rate) VALUES (?, ?)');

  fs.createReadStream(CSV_FILE)
    .pipe(csv())
    .on('data', (row) => {
      const date = row.DATE?.trim();
      const rate = row.VALUE === '.' ? null : parseFloat(row.VALUE);
      if (date && rate !== null) {
        stmt.run(date, rate);
      }
    })
    .on('end', () => {
      stmt.finalize();
      console.log('資料匯入完成！');
      db.close();
    });
}

importCSVtoDB().catch(err => {
  console.error('錯誤:', err);
});
