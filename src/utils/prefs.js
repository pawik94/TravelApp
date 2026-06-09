import * as FileSystem from 'expo-file-system';

const prefsPath = (tripId) => FileSystem.documentDirectory + 'prefs_trip_' + tripId + '.json';

export const savePrefs = async (tripId, prefs) => {
  try {
    await FileSystem.writeAsStringAsync(prefsPath(tripId), JSON.stringify(prefs));
  } catch (_) {}
};

export const loadPrefs = async (tripId) => {
  try {
    const text = await FileSystem.readAsStringAsync(prefsPath(tripId));
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
};
