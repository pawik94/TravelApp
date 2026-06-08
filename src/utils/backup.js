/**
 * backup.js — eksport i import pełnych danych podróży w formacie JSON
 *
 * Eksport: cała podróż → JSON → Share (e-mail, Drive, itp.)
 * Import: wybierz plik JSON → wczytaj → wstaw do bazy jako nową podróż
 *
 * Format pliku:
 * {
 *   version: 1,
 *   exported_at: "2025-06-08T12:00:00.000Z",
 *   trip: { ...pola tabeli trips },
 *   travelers: [ ...],
 *   pairs: [...],
 *   categories: [...],
 *   expenses: [ { ...pola, shares: [...] } ],
 *   payments: [...]
 * }
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { getDB } from '../database/db';

const BACKUP_VERSION = 1;

// ─── EKSPORT ──────────────────────────────────────────────────────────────────

export const exportTripJSON = async (tripId, tripName) => {
  const db = await getDB();

  const trip = await db.getFirstAsync('SELECT * FROM trips WHERE id=?', [tripId]);
  const travelers = await db.getAllAsync('SELECT * FROM travelers WHERE trip_id=?', [tripId]);
  const pairs = await db.getAllAsync('SELECT * FROM pairs WHERE trip_id=?', [tripId]);
  const categories = await db.getAllAsync('SELECT * FROM categories WHERE trip_id=?', [tripId]);
  const expenses = await db.getAllAsync('SELECT * FROM expenses WHERE trip_id=?', [tripId]);
  const payments = await db.getAllAsync('SELECT * FROM payments WHERE trip_id=?', [tripId]);

  // Dołącz shares do każdego wydatku
  for (const exp of expenses) {
    exp.shares = await db.getAllAsync(
      'SELECT traveler_id, custom_amount FROM expense_shares WHERE expense_id=?',
      [exp.id]
    );
  }

  const backup = {
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    trip,
    travelers,
    pairs,
    categories,
    expenses,
    payments,
  };

  const json = JSON.stringify(backup, null, 2);
  const safeName = tripName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `backup_${safeName}_${Date.now()}.json`;
  const filePath = FileSystem.cacheDirectory + fileName;

  await FileSystem.writeAsStringAsync(filePath, json, { encoding: FileSystem.EncodingType.UTF8 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filePath, { mimeType: 'application/json', dialogTitle: `Eksport: ${tripName}` });
  } else {
    Alert.alert('Błąd', 'Udostępnianie niedostępne na tym urządzeniu');
  }
};

// ─── IMPORT ──────────────────────────────────────────────────────────────────

export const importTripJSON = async () => {
  // 1. Wybierz plik
  let result;
  try {
    result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
  } catch (e) {
    Alert.alert('Błąd', 'Nie udało się otworzyć pliku');
    return null;
  }

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];

  // 2. Wczytaj i sparsuj JSON
  let backup;
  try {
    const text = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
    backup = JSON.parse(text);
  } catch (e) {
    Alert.alert('Błąd', 'Nieprawidłowy plik — nie można go odczytać');
    return null;
  }

  // 3. Walidacja formatu
  if (!backup.version || !backup.trip || !Array.isArray(backup.travelers)) {
    Alert.alert('Błąd', 'To nie jest prawidłowy plik kopii zapasowej Travel Expenses');
    return null;
  }

  // 4. Wstaw do bazy jako nową podróż (nie nadpisuj!)
  const db = await getDB();
  let newTripId;

  try {
    // Nowa podróż
    const { trip } = backup;
    const tripRes = await db.runAsync(
      'INSERT INTO trips (name,destination,start_date,end_date,comment,default_currency) VALUES (?,?,?,?,?,?)',
      [
        trip.name + ' (import)',
        trip.destination || '',
        trip.start_date || '',
        trip.end_date || '',
        trip.comment || '',
        trip.default_currency || 'EUR',
      ]
    );
    newTripId = tripRes.lastInsertRowId;

    // Mapa starych ID podróżników → nowe ID
    const travelerMap = {};
    for (const t of backup.travelers) {
      const r = await db.runAsync(
        'INSERT INTO travelers (trip_id, name) VALUES (?,?)',
        [newTripId, t.name]
      );
      travelerMap[t.id] = r.lastInsertRowId;
    }

    // Mapa starych ID kategorii → nowe ID
    const categoryMap = {};
    for (const c of backup.categories) {
      const r = await db.runAsync(
        'INSERT INTO categories (trip_id, name, color) VALUES (?,?,?)',
        [newTripId, c.name, c.color || '#757575']
      );
      categoryMap[c.id] = r.lastInsertRowId;
    }

    // Pary (po mapowaniu podróżników)
    const pairMap = {};
    for (const p of (backup.pairs || [])) {
      const t1 = travelerMap[p.traveler1_id];
      const t2 = travelerMap[p.traveler2_id];
      if (!t1 || !t2) continue;
      const r = await db.runAsync(
        'INSERT INTO pairs (trip_id,name,traveler1_id,traveler2_id) VALUES (?,?,?,?)',
        [newTripId, p.name, t1, t2]
      );
      pairMap[p.id] = r.lastInsertRowId;
    }

    // Wydatki + shares
    for (const exp of (backup.expenses || [])) {
      const newPaidBy = travelerMap[exp.paid_by];
      const newCatId  = exp.category_id ? categoryMap[exp.category_id] : null;
      if (!newPaidBy) continue;

      const r = await db.runAsync(
        `INSERT INTO expenses
          (trip_id,paid_by,category_id,amount,currency,amount_pln,exchange_rate,
           date,method,is_shared,include_in_split,comment)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          newTripId, newPaidBy, newCatId || null,
          exp.amount, exp.currency, exp.amount_pln, exp.exchange_rate,
          exp.date, exp.method, exp.is_shared ? 1 : 0,
          exp.include_in_split !== 0 ? 1 : 0, exp.comment || '',
        ]
      );
      const newExpId = r.lastInsertRowId;

      for (const s of (exp.shares || [])) {
        const newTvlId = travelerMap[s.traveler_id];
        if (!newTvlId) continue;
        await db.runAsync(
          'INSERT INTO expense_shares (expense_id,traveler_id,custom_amount) VALUES (?,?,?)',
          [newExpId, newTvlId, s.custom_amount ?? null]
        );
      }
    }

    // Płatności
    for (const p of (backup.payments || [])) {
      const from = travelerMap[p.from_traveler];
      const to   = travelerMap[p.to_traveler];
      if (!from || !to) continue;
      const pairId = p.on_behalf_pair ? pairMap[p.on_behalf_pair] : null;
      await db.runAsync(
        'INSERT INTO payments (trip_id,from_traveler,to_traveler,amount,date,note,on_behalf_pair) VALUES (?,?,?,?,?,?,?)',
        [newTripId, from, to, p.amount, p.date, p.note || '', pairId || null]
      );
    }

    Alert.alert(
      '✅ Import zakończony',
      `Podróż "${trip.name}" została przywrócona jako "${trip.name} (import)".\n\n` +
      `Podróżnicy: ${backup.travelers.length}\n` +
      `Wydatki: ${backup.expenses?.length || 0}\n` +
      `Płatności: ${backup.payments?.length || 0}`
    );

    return newTripId;
  } catch (e) {
    console.error('Import error:', e);
    // Spróbuj posprzątać po błędzie
    if (newTripId) {
      try { await db.runAsync('DELETE FROM trips WHERE id=?', [newTripId]); } catch (_) {}
    }
    Alert.alert('Błąd importu', 'Nie udało się zaimportować danych.\n\n' + e.message);
    return null;
  }
};
