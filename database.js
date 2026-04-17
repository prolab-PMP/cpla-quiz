const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'cpla.db');
let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA foreign_keys = ON');
  setInterval(() => saveDb(), 30000);
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

class DbWrapper {
  constructor(sqlDb) { this._db = sqlDb; }

  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        self._db.run(sql, params);
        const info = self._db.exec("SELECT last_insert_rowid() as id, changes() as changes");
        return {
          lastInsertRowid: info[0]?.values[0]?.[0] || 0,
          changes: info[0]?.values[0]?.[1] || 0
        };
      },
      get(...params) {
        const stmt = self._db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          stmt.free();
          const row = {};
          cols.forEach((c, i) => row[c] = vals[i]);
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const results = [];
        const stmt = self._db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          const row = {};
          cols.forEach((c, i) => row[c] = vals[i]);
          results.push(row);
        }
        stmt.free();
        return results;
      }
    };
  }

  exec(sql) { this._db.run(sql); }

  transaction(fn) {
    return (...args) => {
      this._db.run('BEGIN');
      try {
        const result = fn(...args);
        this._db.run('COMMIT');
        saveDb();
        return result;
      } catch (e) {
        this._db.run('ROLLBACK');
        throw e;
      }
    };
  }

  pragma(str) {
    try { this._db.run(`PRAGMA ${str}`); } catch {}
  }
}

let wrapper = null;

async function initWrapper() {
  const sqlDb = await getDb();
  wrapper = new DbWrapper(sqlDb);
  return wrapper;
}

module.exports = {
  getWrapper: initWrapper,
  save: saveDb,
  getDb
};
