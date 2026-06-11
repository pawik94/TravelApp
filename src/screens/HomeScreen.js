import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import { COLORS } from '../theme';
import { getTrips, deleteTrip, getTripStats, setTripArchived } from '../database/db';
import { formatPLN, formatDate } from '../utils/currency';
import Header from '../components/Header';
import { importTripJSON, exportAllTripsJSON } from '../utils/backup';

export default function HomeScreen({ navigation }) {
  const [trips, setTrips] = useState([]);
  const [stats, setStats] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const [showArchived, setShowArchived] = useState(false);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    const data = await getTrips(showArchived);
    setTrips(data);
    const s = {};
    for (const t of data) { s[t.id] = await getTripStats(t.id); }
    setStats(s);
    setRefreshing(false);
  }, [showArchived, tick]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleLongPress = (trip) => {
    Alert.alert(trip.name, '', [
      { text:'✏️ Edytuj', onPress:() => navigation.navigate('AddTrip', { tripId:trip.id, onBack:() => setTick(t=>t+1) }) },
      { text: trip.archived ? '📂 Przywróć' : '📁 Archiwizuj', onPress: async () => { await setTripArchived(trip.id, !trip.archived); loadData(); } },
      { text:'🗑️ Usuń', style:'destructive', onPress:() =>
          Alert.alert('Usuń podróż', 'Usunąć ' + trip.name + '?', [
            { text:'Anuluj', style:'cancel' },
            { text:'Usuń', style:'destructive', onPress:async () => { await deleteTrip(trip.id); loadData(); } },
          ])
      },
      { text:'Anuluj', style:'cancel' },
    ], { cancelable: true });
  };

  const handleBackup = () => {
    Alert.alert(
      'Kopia zapasowa',
      'Co chcesz zrobić?',
      [
        { text: '💾 Zapisz dane', onPress: async () => { await exportAllTripsJSON(); } },
        { text: '📥 Wczytaj dane', onPress: async () => { const id = await importTripJSON(); if (id) loadData(); } },
        { text: 'Anuluj', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const renderTrip = ({ item }) => {
    const s = stats[item.id] || { count:0, total:0 };
    return (
      <TouchableOpacity style={styles.card}
        onPress={() => navigation.navigate('Trip', { tripId:item.id, tripName:item.name, onBack:() => setTick(t=>t+1) })}
        onLongPress={() => handleLongPress(item)} activeOpacity={0.75}>
        <View style={styles.cardTop}>
          <Text style={styles.tripName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.tripTotal}>{formatPLN(s.total)}</Text>
        </View>
        {item.destination ? <Text style={styles.meta}>📍 {item.destination}</Text> : null}
        {item.start_date  ? <Text style={styles.meta}>📅 {formatDate(item.start_date)}{item.end_date ? ' – ' + formatDate(item.end_date) : ''}</Text> : null}
        <View style={styles.countRow}>
          <Text style={styles.count}>{s.count} wydatków</Text>
          {item.archived ? <Text style={styles.archivedBadge}>📁 Archiwum</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Moje Podroze" />
      <FlatList data={trips} keyExtractor={item=>String(item.id)} renderItem={renderTrip}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✈️</Text>
            <Text style={styles.emptyTitle}>Brak podróży</Text>
            <Text style={styles.emptyHint}>Naciśnij + aby dodać pierwszą podróż</Text>
          </View>
        }
      />
      <TouchableOpacity style={styles.fabTertiary} onPress={()=>setShowArchived(v=>!v)} activeOpacity={0.85}>
        <Text style={styles.fabIconSm}>{showArchived?'🏠':'📁'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.fabSecondary} onPress={handleBackup} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>💾</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddTrip', { onBack:() => setTick(t=>t+1) })} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:COLORS.background },
  list:     { padding:16, paddingBottom:90 },
  card:     { backgroundColor:COLORS.surface, borderRadius:14, padding:16, marginBottom:12, borderWidth:1, borderColor:COLORS.border },
  cardTop:  { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 },
  tripName: { flex:1, fontSize:18, fontWeight:'700', color:COLORS.text, marginRight:8 },
  tripTotal:{ fontSize:18, fontWeight:'700', color:COLORS.primary },
  meta:     { fontSize:13, color:COLORS.textSecondary, marginBottom:3 },
  count:    { fontSize:12, color:COLORS.textSecondary, marginTop:4 },
  countRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:4 },
  archivedBadge: { fontSize:11, color:COLORS.textSecondary, fontStyle:'italic' },
  fabIconSm:{ color:COLORS.text, fontSize:22, lineHeight:26 },
  empty:    { alignItems:'center', marginTop:80 },
  emptyIcon:{ fontSize:64, marginBottom:16 },
  emptyTitle:{ fontSize:20, color:COLORS.text, fontWeight:'700' },
  emptyHint: { fontSize:14, color:COLORS.textSecondary, marginTop:8, textAlign:'center' },
  fabTertiary:  { position:'absolute', right:160, bottom:28, width:58, height:58, borderRadius:29, backgroundColor:COLORS.surfaceVariant, borderWidth:1, borderColor:COLORS.border, alignItems:'center', justifyContent:'center', elevation:4 },
  fabSecondary: { position:'absolute', right:90, bottom:28, width:58, height:58, borderRadius:29, backgroundColor:COLORS.surfaceVariant, borderWidth:1, borderColor:COLORS.border, alignItems:'center', justifyContent:'center', elevation:4 },
  fab:      { position:'absolute', right:20, bottom:28, width:58, height:58, borderRadius:29, backgroundColor:COLORS.primary, alignItems:'center', justifyContent:'center', elevation:8 },
  fabIcon:  { color:COLORS.white, fontSize:32, lineHeight:36 },
});
