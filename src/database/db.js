import * as SQLite from 'expo-sqlite';
import { DEFAULT_CATEGORIES } from '../theme';

let _db = null;

export const getDB = async () => {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('travelexpenses.db');
    await _initDB(_db);
  }
  return _db;
};

const _initDB = async (db) => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      destination TEXT DEFAULT '', start_date TEXT DEFAULT '', end_date TEXT DEFAULT '',
      comment TEXT DEFAULT '', default_currency TEXT DEFAULT 'EUR',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS travelers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER NOT NULL, name TEXT NOT NULL,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS pairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER NOT NULL,
      name TEXT NOT NULL, traveler1_id INTEGER NOT NULL, traveler2_id INTEGER NOT NULL,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (traveler1_id) REFERENCES travelers(id) ON DELETE CASCADE,
      FOREIGN KEY (traveler2_id) REFERENCES travelers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER NOT NULL, name TEXT NOT NULL, color TEXT DEFAULT '#757575'
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER NOT NULL, paid_by INTEGER NOT NULL,
      category_id INTEGER, amount REAL NOT NULL DEFAULT 0, currency TEXT DEFAULT 'PLN',
      amount_pln REAL NOT NULL DEFAULT 0, exchange_rate REAL DEFAULT 1, date TEXT NOT NULL,
      method TEXT DEFAULT 'Gotowka', is_shared INTEGER DEFAULT 1, include_in_split INTEGER DEFAULT 1,
      comment TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS expense_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT, expense_id INTEGER NOT NULL,
      traveler_id INTEGER NOT NULL, custom_amount REAL DEFAULT NULL,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY (traveler_id) REFERENCES travelers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER NOT NULL,
      from_traveler INTEGER NOT NULL, to_traveler INTEGER NOT NULL,
      amount REAL NOT NULL, date TEXT NOT NULL, note TEXT DEFAULT '',
      on_behalf_pair INTEGER DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (from_traveler) REFERENCES travelers(id),
      FOREIGN KEY (to_traveler) REFERENCES travelers(id)
    );
  `);
  try { await db.execAsync(`ALTER TABLE trips ADD COLUMN default_currency TEXT DEFAULT 'EUR'`); } catch (_) {}
  try { await db.execAsync('ALTER TABLE trips ADD COLUMN archived INTEGER DEFAULT 0'); } catch (_) {}
  try { await db.execAsync(`ALTER TABLE expense_shares ADD COLUMN custom_amount REAL DEFAULT NULL`); } catch (_) {}
  try { await db.execAsync(`ALTER TABLE payments ADD COLUMN on_behalf_pair INTEGER DEFAULT NULL`); } catch (_) {}
  try {
    await db.execAsync(`CREATE TABLE IF NOT EXISTS pairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER NOT NULL,
      name TEXT NOT NULL, traveler1_id INTEGER NOT NULL, traveler2_id INTEGER NOT NULL,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (traveler1_id) REFERENCES travelers(id) ON DELETE CASCADE,
      FOREIGN KEY (traveler2_id) REFERENCES travelers(id) ON DELETE CASCADE
    )`);
  } catch (_) {}
};

// ─── TRIPS ───────────────────────────────────────────────────────────────────
export const getTrips = async (archived = false) => {
  const db = await getDB();
  const where = archived ? 'WHERE archived=1' : 'WHERE (archived=0 OR archived IS NULL)';
  return db.getAllAsync('SELECT * FROM trips ' + where + ' ORDER BY created_at DESC');
};
export const setTripArchived = async (tripId, archived) => {
  const db = await getDB();
  await db.runAsync('UPDATE trips SET archived=? WHERE id=?', [archived ? 1 : 0, tripId]);
};
export const getTripById = async (id) => { const db = await getDB(); return db.getFirstAsync('SELECT * FROM trips WHERE id=?', [id]); };
export const getTripStats = async (tripId) => { const db = await getDB(); return db.getFirstAsync(`SELECT COUNT(*) AS count, COALESCE(SUM(amount_pln), 0) AS total FROM expenses WHERE trip_id=?`, [tripId]); };
export const insertTrip = async (trip) => {
  const db = await getDB();
  const r = await db.runAsync('INSERT INTO trips (name,destination,start_date,end_date,comment,default_currency) VALUES (?,?,?,?,?,?)',
    [trip.name, trip.destination||'', trip.start_date||'', trip.end_date||'', trip.comment||'', trip.default_currency||'EUR']);
  const tripId = r.lastInsertRowId;
  for (const cat of DEFAULT_CATEGORIES) await db.runAsync('INSERT INTO categories (trip_id,name,color) VALUES (?,?,?)', [tripId, cat.name, cat.color]);
  return tripId;
};
export const updateTrip = async (trip) => {
  const db = await getDB();
  await db.runAsync('UPDATE trips SET name=?,destination=?,start_date=?,end_date=?,comment=?,default_currency=? WHERE id=?',
    [trip.name, trip.destination||'', trip.start_date||'', trip.end_date||'', trip.comment||'', trip.default_currency||'EUR', trip.id]);
};
export const deleteTrip = async (id) => { const db = await getDB(); await db.runAsync('DELETE FROM trips WHERE id=?', [id]); };

// ─── TRAVELERS ───────────────────────────────────────────────────────────────
export const getTravelers = async (tripId) => { const db = await getDB(); return db.getAllAsync('SELECT * FROM travelers WHERE trip_id=? ORDER BY id', [tripId]); };
export const insertTraveler = async (tripId, name) => { const db = await getDB(); const r = await db.runAsync('INSERT INTO travelers (trip_id,name) VALUES (?,?)', [tripId, name]); return r.lastInsertRowId; };
export const deleteTraveler = async (id) => { const db = await getDB(); await db.runAsync('DELETE FROM travelers WHERE id=?', [id]); };

// ─── PAIRS ───────────────────────────────────────────────────────────────────
export const getPairs = async (tripId) => {
  const db = await getDB();
  return db.getAllAsync(`
    SELECT p.*, t1.name AS name1, t2.name AS name2
    FROM pairs p
    JOIN travelers t1 ON p.traveler1_id = t1.id
    JOIN travelers t2 ON p.traveler2_id = t2.id
    WHERE p.trip_id=? ORDER BY p.id`, [tripId]);
};
export const insertPair = async (tripId, name, t1id, t2id) => {
  const db = await getDB();
  const r = await db.runAsync('INSERT INTO pairs (trip_id,name,traveler1_id,traveler2_id) VALUES (?,?,?,?)', [tripId, name, t1id, t2id]);
  return r.lastInsertRowId;
};
export const deletePair = async (id) => { const db = await getDB(); await db.runAsync('DELETE FROM pairs WHERE id=?', [id]); };

// ─── CATEGORIES ──────────────────────────────────────────────────────────────
export const getCategories = async (tripId) => { const db = await getDB(); return db.getAllAsync('SELECT * FROM categories WHERE trip_id=? ORDER BY name', [tripId]); };
export const insertCategory = async (tripId, name, color) => { const db = await getDB(); const r = await db.runAsync('INSERT INTO categories (trip_id,name,color) VALUES (?,?,?)', [tripId, name, color]); return r.lastInsertRowId; };
export const updateCategory = async (id, name, color) => { const db = await getDB(); await db.runAsync('UPDATE categories SET name=?,color=? WHERE id=?', [name, color, id]); };
export const deleteCategory = async (id) => { const db = await getDB(); await db.runAsync('DELETE FROM categories WHERE id=?', [id]); };

// ─── EXPENSES ────────────────────────────────────────────────────────────────
export const getExpenses = async (tripId, filters = {}) => {
  const db = await getDB();
  let q = `SELECT e.*, t.name AS payer_name, c.name AS category_name, c.color AS category_color
    FROM expenses e LEFT JOIN travelers t ON e.paid_by=t.id LEFT JOIN categories c ON e.category_id=c.id
    WHERE e.trip_id=?`;
  const p = [tripId];
  if (filters.travelerId) { q += ' AND e.paid_by=?'; p.push(filters.travelerId); }
  if (filters.categoryId) { q += ' AND e.category_id=?'; p.push(filters.categoryId); }
  return db.getAllAsync(q + ' ORDER BY e.date DESC, e.id DESC', p);
};
export const getExpenseById = async (id) => { const db = await getDB(); return db.getFirstAsync('SELECT * FROM expenses WHERE id=?', [id]); };
export const getExpenseShares = async (expenseId) => {
  const db = await getDB();
  return db.getAllAsync('SELECT es.traveler_id, es.custom_amount, t.name FROM expense_shares es JOIN travelers t ON es.traveler_id=t.id WHERE es.expense_id=?', [expenseId]);
};
export const insertExpense = async (expense, shares = []) => {
  const db = await getDB();
  const r = await db.runAsync(
    `INSERT INTO expenses (trip_id,paid_by,category_id,amount,currency,amount_pln,exchange_rate,date,method,is_shared,include_in_split,comment) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [expense.trip_id,expense.paid_by,expense.category_id||null,expense.amount,expense.currency,expense.amount_pln,expense.exchange_rate,expense.date,expense.method,expense.is_shared?1:0,expense.include_in_split!==false?1:0,expense.comment||'']
  );
  const expenseId = r.lastInsertRowId;
  for (const s of shares) await db.runAsync('INSERT INTO expense_shares (expense_id,traveler_id,custom_amount) VALUES (?,?,?)', [expenseId, s.traveler_id, s.custom_amount??null]);
  return expenseId;
};
export const updateExpense = async (expense, shares = []) => {
  const db = await getDB();
  await db.runAsync(
    `UPDATE expenses SET paid_by=?,category_id=?,amount=?,currency=?,amount_pln=?,exchange_rate=?,date=?,method=?,is_shared=?,include_in_split=?,comment=? WHERE id=?`,
    [expense.paid_by,expense.category_id||null,expense.amount,expense.currency,expense.amount_pln,expense.exchange_rate,expense.date,expense.method,expense.is_shared?1:0,expense.include_in_split!==false?1:0,expense.comment||'',expense.id]
  );
  await db.runAsync('DELETE FROM expense_shares WHERE expense_id=?', [expense.id]);
  for (const s of shares) await db.runAsync('INSERT INTO expense_shares (expense_id,traveler_id,custom_amount) VALUES (?,?,?)', [expense.id, s.traveler_id, s.custom_amount??null]);
};
export const deleteExpense = async (id) => { const db = await getDB(); await db.runAsync('DELETE FROM expenses WHERE id=?', [id]); };
export const getExpensesForSettlement = async (tripId) => {
  const db = await getDB();
  const expenses = await db.getAllAsync('SELECT * FROM expenses WHERE trip_id=? AND include_in_split=1', [tripId]);
  for (const exp of expenses) {
    exp.shares = exp.is_shared ? [] : await db.getAllAsync('SELECT traveler_id, custom_amount FROM expense_shares WHERE expense_id=?', [exp.id]);
  }
  return expenses;
};

// ─── PAYMENTS ────────────────────────────────────────────────────────────────
export const getPayments = async (tripId) => {
  const db = await getDB();
  return db.getAllAsync(`
    SELECT p.*, f.name AS from_name, t.name AS to_name,
           pr.name AS pair_name, pr.traveler1_id, pr.traveler2_id
    FROM payments p
    JOIN travelers f ON p.from_traveler=f.id
    JOIN travelers t ON p.to_traveler=t.id
    LEFT JOIN pairs pr ON p.on_behalf_pair=pr.id
    WHERE p.trip_id=? ORDER BY p.date DESC, p.id DESC`, [tripId]);
};
export const insertPayment = async (p) => {
  const db = await getDB();
  await db.runAsync('INSERT INTO payments (trip_id,from_traveler,to_traveler,amount,date,note,on_behalf_pair) VALUES (?,?,?,?,?,?,?)',
    [p.trip_id, p.from_traveler, p.to_traveler, p.amount, p.date, p.note||'', p.on_behalf_pair||null]);
};
export const deletePayment = async (id) => { const db = await getDB(); await db.runAsync('DELETE FROM payments WHERE id=?', [id]); };
export const updatePayment = async (p) => {
  const db = await getDB();
  await db.runAsync(
    'UPDATE payments SET from_traveler=?,to_traveler=?,amount=?,date=?,note=?,on_behalf_pair=? WHERE id=?',
    [p.from_traveler, p.to_traveler, p.amount, p.date, p.note||'', p.on_behalf_pair||null, p.id]
  );
};

export const exportTripCSV = async (tripId) => {
  const db = await getDB();
  const trip = await db.getFirstAsync('SELECT * FROM trips WHERE id=?', [tripId]);
  const expenses = await getExpenses(tripId);
  const header = 'Data;Kategoria;Kto;Kwota;Waluta;Kurs;PLN;Metoda;Wspolny;Komentarz\n';
  const rows = expenses.map(e => [e.date,e.category_name||'',e.payer_name,e.amount,e.currency,e.exchange_rate,e.amount_pln.toFixed(2),e.method,e.is_shared?'tak':'nie',e.comment||''].join(';')).join('\n');
  return `Podroz: ${trip.name}\n${header}${rows}`;
};
