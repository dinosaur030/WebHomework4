// === app.js ===
// 更新最新匯率資料到 SQLite

const express = require('express');
const path = require('path'); // ✅ 加這行
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ✅ 新增這一行！讓 public 資料夾的 index.html 可以被存取
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./exchange_rates.db');

// === FRED API Key ===
const FRED_API_KEY = '1df37e7ab0694a0cd0e84c99678a7cc5';
const FRED_API_URL = 'https://api.stlouisfed.org/fred/series/observations';

// === 取得資料庫最新日期 ===
async function getLatestDate() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT date FROM exchange_rates ORDER BY date DESC LIMIT 1`, (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.date : null);
    });
  });
}

// === 抓取並更新資料 ===
async function fetchAndUpdateData() {
  const latestDate = await getLatestDate();
  console.log('資料庫最新日期:', latestDate);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  if (!latestDate) {
    console.log('資料庫無資料，請先執行 init.js 匯入歷史資料！');
    return;
  }

  const url = `${FRED_API_URL}?series_id=DEXTAUS&api_key=${FRED_API_KEY}&file_type=json&observation_start=${latestDate}&observation_end=${todayStr}`;

  const response = await axios.get(url);
  const observations = response.data.observations || [];

  db.serialize(() => {
    const stmt = db.prepare(`INSERT OR IGNORE INTO exchange_rates (date, rate) VALUES (?, ?)`);
    observations.forEach(obs => {
      const date = obs.date;
      const value = obs.value === '.' ? null : parseFloat(obs.value);
      if (value !== null) {
        stmt.run(date, value);
      }
    });
    stmt.finalize();
    console.log(`更新完成，共新增 ${observations.length} 筆資料`);
  });
}

// === API: 查詢資料庫中的匯率資料 ===
app.get('/api/usd-twd-history', (req, res) => {
  db.all(`SELECT * FROM exchange_rates ORDER BY date ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// === 啟動伺服器並自動更新資料 ===
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  try {
    await fetchAndUpdateData();
  } catch (err) {
    console.error('更新失敗:', err.message);
  }
});
