const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(dbDir, 'bot.db');
const schemaPath = path.join(__dirname, 'schema.sql');

let db = null;
let initPromise = null;

function saveToDisk() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function rowsFromExec(results) {
  if (!results || results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

function ensureReady() {
  if (!db) {
    throw new Error('[DB] Database not initialized. Call db.init() first.');
  }
}

function init() {
  if (initPromise) return initPromise;
  initPromise = initSqlJs().then((SQL) => {
    let data = null;
    if (fs.existsSync(dbPath)) {
      data = new Uint8Array(fs.readFileSync(dbPath));
    }
    db = data ? new SQL.Database(data) : new SQL.Database();

    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');

    saveToDisk();
  });
  return initPromise;
}

module.exports = {
  init,
  prepare(sql) {
    ensureReady();
    return {
      get(...params) {
        const results = db.exec(sql, params);
        const rows = rowsFromExec(results);
        return rows[0];
      },
      all(...params) {
        const results = db.exec(sql, params);
        return rowsFromExec(results);
      },
      run(...params) {
        db.run(sql, params);
        saveToDisk();
      },
    };
  },
  exec(sql) {
    ensureReady();
    db.exec(sql);
    saveToDisk();
  },
  pragma(statement) {
    ensureReady();
    db.exec(`PRAGMA ${statement}`);
  },
};
