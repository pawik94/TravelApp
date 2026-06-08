import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, CURRENCIES } from '../theme';
import { getTripById, getTravelers, insertTrip, updateTrip, insertTraveler, deleteTraveler, getPairs, insertPair, deletePair } from '../database/db';
import { formatDate } from '../utils/currency';
import Header from '../components/Header';
import ModalPicker from '../components/ModalPicker';

export default function AddTripScreen({ navigation, route }) {
  const { tripId:editId, onBack } = route.params||{};
  const [name,setName]=useState(''); const [destination,setDestination]=useState('');
  const [startDate,setStartDate]=useState(''); const [endDate,setEndDate]=useState('');
  const [comment,setComment]=useState(''); const [defaultCurrency,setDefaultCurrency]=useState('EUR');
  const [travelers,setTravelers]=useState([]); const [newTraveler,setNewTraveler]=useState('');
  const [pairs,setPairs]=useState([]);
  const [datePickerStep,setDatePickerStep]=useState(null); // null | 'start' | 'end'
  const [showPairModal,setShowPairModal]=useState(false);
  const [pairT1,setPairT1]=useState(null); const [pairT2,setPairT2]=useState(null); const [pairName,setPairName]=useState('');

  useEffect(() => { if (editId) loadTrip(); }, [editId]);

  const loadTrip = async () => {
    const trip = await getTripById(editId);
    if (!trip) return;
    setName(trip.name); setDestination(trip.destination||'');
    setStartDate(trip.start_date||''); setEndDate(trip.end_date||'');
    setComment(trip.comment||''); setDefaultCurrency(trip.default_currency||'EUR');
    const tvl = await getTravelers(editId);
    setTravelers(tvl);
    setPairs(await getPairs(editId));
  };

  const openDatePicker = () => setDatePickerStep('start');

  const handleDateChange = (_, d) => {
    if (!d) { setDatePickerStep(null); return; }
    const iso = d.toISOString().split('T')[0];
    if (datePickerStep === 'start') {
      setStartDate(iso);
      if (endDate && endDate < iso) setEndDate('');
      setDatePickerStep('end');
    } else {
      setEndDate(iso);
      setDatePickerStep(null);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Błąd','Wpisz nazwę podróży'); return; }
    const tripData = { name:name.trim(), destination:destination.trim(), start_date:startDate, end_date:endDate, comment:comment.trim(), default_currency:defaultCurrency };
    if (editId) {
      await updateTrip({ ...tripData, id:editId });
      onBack && onBack(); navigation.goBack();
    } else {
      const tripId = await insertTrip(tripData);
      const savedIds = {};
      for (const t of travelers) {
        const id = await insertTraveler(tripId, t.name);
        savedIds[t.id] = id;
      }
      // Save pairs using newly created traveler IDs
      for (const p of pairs) {
        const t1 = savedIds[p.traveler1_id]||p.traveler1_id;
        const t2 = savedIds[p.traveler2_id]||p.traveler2_id;
        if (t1 && t2) await insertPair(tripId, p.name, t1, t2);
      }
      onBack && onBack();
      navigation.replace('Trip', { tripId, tripName:tripData.name });
    }
  };

  const addTraveler = () => {
    const n = newTraveler.trim(); if (!n) return; setNewTraveler('');
    if (editId) {
      insertTraveler(editId, n).then(id => setTravelers(prev=>[...prev,{id,name:n}]));
    } else {
      setTravelers(prev=>[...prev,{id:-Date.now(),name:n}]);
    }
  };

  const removeTraveler = async (t) => {
    // Remove associated pairs too
    setPairs(prev => prev.filter(p => p.traveler1_id!==t.id && p.traveler2_id!==t.id));
    if (editId && t.id>0) await deleteTraveler(t.id);
    setTravelers(prev=>prev.filter(x=>x.id!==t.id));
  };

  const openPairModal = () => {
    setPairT1(travelers[0]?.id||null);
    setPairT2(travelers[1]?.id||null);
    setPairName('');
    setShowPairModal(true);
  };

  const savePair = async () => {
    if (!pairT1||!pairT2)      { Alert.alert('Błąd','Wybierz dwie osoby'); return; }
    if (pairT1===pairT2)       { Alert.alert('Błąd','Wybierz dwie różne osoby'); return; }
    const t1 = travelers.find(t=>t.id===pairT1);
    const t2 = travelers.find(t=>t.id===pairT2);
    const name = pairName.trim() || (t1?.name||'') + ' + ' + (t2?.name||'');
    if (editId) {
      const id = await insertPair(editId, name, pairT1, pairT2);
      const t1n = travelers.find(t=>t.id===pairT1)?.name||'';
      const t2n = travelers.find(t=>t.id===pairT2)?.name||'';
      setPairs(prev=>[...prev,{id,name,traveler1_id:pairT1,traveler2_id:pairT2,name1:t1n,name2:t2n}]);
    } else {
      const t1n = travelers.find(t=>t.id===pairT1)?.name||'';
      const t2n = travelers.find(t=>t.id===pairT2)?.name||'';
      setPairs(prev=>[...prev,{id:-Date.now(),name,traveler1_id:pairT1,traveler2_id:pairT2,name1:t1n,name2:t2n}]);
    }
    setShowPairModal(false);
  };

  const removePair = async (p) => {
    if (editId && p.id>0) await deletePair(p.id);
    setPairs(prev=>prev.filter(x=>x.id!==p.id));
  };

  const travelerOptions = travelers.map(t=>({label:t.name,value:t.id}));

  return (
    <KeyboardAvoidingView style={{flex:1,backgroundColor:COLORS.background}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <Header title={editId?'Edytuj Podróż':'Nowa Podróż'} showBack onBack={()=>{onBack&&onBack();navigation.goBack();}} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.section}>Szczegóły podróży</Text>
        <TextInput style={styles.input} placeholder="Nazwa podróży *" placeholderTextColor={COLORS.textSecondary} value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Cel podróży (np. Islandia)" placeholderTextColor={COLORS.textSecondary} value={destination} onChangeText={setDestination} />
        <TouchableOpacity style={styles.dateRangeBtn} onPress={openDatePicker} activeOpacity={0.75}>
          <Text style={styles.dateLbl}>
            {datePickerStep==='start'?'Wybierz datę początkową...':
             datePickerStep==='end'  ?'Wybierz datę końcową...':'Termin podróży'}
          </Text>
          <View style={styles.dateRangeRow}>
            <Text style={[styles.dateVal,!startDate&&styles.datePlaceholder]}>
              {startDate?formatDate(startDate):'Data od'}
            </Text>
            <Text style={styles.dateArrow}> → </Text>
            <Text style={[styles.dateVal,!endDate&&styles.datePlaceholder]}>
              {endDate?formatDate(endDate):'Data do'}
            </Text>
          </View>
        </TouchableOpacity>
        {datePickerStep!==null&&(
          <DateTimePicker
            value={datePickerStep==='end'&&endDate?new Date(endDate):(startDate?new Date(startDate):new Date())}
            mode="date" display="default"
            minimumDate={datePickerStep==='end'&&startDate?new Date(startDate):undefined}
            onChange={handleDateChange}
          />
        )}
        <TextInput style={[styles.input,{height:70,textAlignVertical:'top'}]} placeholder="Komentarz" placeholderTextColor={COLORS.textSecondary} value={comment} onChangeText={setComment} multiline />

        <Text style={styles.section}>Domyślna waluta</Text>
        <ModalPicker value={defaultCurrency} options={CURRENCIES.map(c=>({label:c,value:c}))} onChange={setDefaultCurrency} title="Domyślna waluta" />

        {/* ── Uczestnicy ── */}
        <Text style={styles.section}>Uczestnicy</Text>
        {travelers.map(t => (
          <View key={t.id} style={styles.travelerRow}>
            <Text style={styles.travelerName}>👤 {t.name}</Text>
            <TouchableOpacity onPress={()=>removeTraveler(t)} hitSlop={12}><Text style={styles.removeBtn}>✕</Text></TouchableOpacity>
          </View>
        ))}
        <View style={styles.addRow}>
          <TextInput style={[styles.input,{flex:1,marginBottom:0}]} placeholder="Imię uczestnika" placeholderTextColor={COLORS.textSecondary} value={newTraveler} onChangeText={setNewTraveler} onSubmitEditing={addTraveler} returnKeyType="done" />
          <TouchableOpacity style={styles.addBtn} onPress={addTraveler}><Text style={styles.addBtnText}>Dodaj</Text></TouchableOpacity>
        </View>

        {/* ── Pary ── */}
        {travelers.length >= 2 && (
          <>
            <Text style={styles.section}>Pary</Text>
            <Text style={styles.hint}>Pary upraszczają podział rachunków (np. restauracja)</Text>
            {pairs.map(p => (
              <View key={p.id} style={styles.pairRow}>
                <Text style={styles.pairIcon}>👫</Text>
                <View style={styles.pairInfo}>
                  <Text style={styles.pairName}>{p.name}</Text>
                  <Text style={styles.pairMembers}>{p.name1} + {p.name2}</Text>
                </View>
                <TouchableOpacity onPress={()=>removePair(p)} hitSlop={12}><Text style={styles.removeBtn}>✕</Text></TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addPairBtn} onPress={openPairModal}>
              <Text style={styles.addPairBtnText}>👫  Stwórz parę</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{editId?'Zapisz zmiany':'Utwórz podróż'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Pair creation modal ── */}
      <Modal visible={showPairModal} transparent animationType="slide" statusBarTranslucent>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={()=>setShowPairModal(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={()=>true}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Stwórz parę</Text>

            <Text style={styles.modalLabel}>Osoba 1</Text>
            <ModalPicker value={pairT1} options={travelerOptions} onChange={setPairT1} placeholder="Wybierz..." title="Osoba 1" />

            <Text style={styles.modalLabel}>Osoba 2</Text>
            <ModalPicker value={pairT2} options={travelerOptions} onChange={setPairT2} placeholder="Wybierz..." title="Osoba 2" />

            <Text style={styles.modalLabel}>Nazwa pary (opcjonalnie)</Text>
            <TextInput style={styles.modalInput} placeholder="np. Ania i Bartek" placeholderTextColor={COLORS.textSecondary} value={pairName} onChangeText={setPairName} />

            <TouchableOpacity style={styles.modalSaveBtn} onPress={savePair}>
              <Text style={styles.modalSaveBtnText}>Stwórz parę</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content:{ padding:16, paddingBottom:40 },
  section:{ fontSize:12, fontWeight:'700', color:COLORS.textSecondary, textTransform:'uppercase', letterSpacing:0.8, marginTop:20, marginBottom:10 },
  hint:   { fontSize:12, color:COLORS.textSecondary, marginBottom:10 },
  input:  { backgroundColor:COLORS.surfaceVariant, borderRadius:10, borderWidth:1, borderColor:COLORS.border, color:COLORS.text, fontSize:15, paddingHorizontal:14, paddingVertical:13, marginBottom:10 },
  row:    { flexDirection:'row', marginBottom:10 },
  dateRangeBtn:  { backgroundColor:COLORS.surfaceVariant, borderRadius:10, borderWidth:1, borderColor:COLORS.border, padding:12, marginBottom:10 },
  dateRangeRow:  { flexDirection:'row', alignItems:'center', marginTop:4 },
  dateArrow:     { color:COLORS.textSecondary, fontSize:15, marginHorizontal:4 },
  dateLbl:{ fontSize:11, color:COLORS.textSecondary, marginBottom:2 },
  dateVal:{ fontSize:15, color:COLORS.text, fontWeight:'500' },
  datePlaceholder:{ color:COLORS.textSecondary, fontWeight:'400' },
  travelerRow:{ flexDirection:'row', alignItems:'center', backgroundColor:COLORS.surfaceVariant, borderRadius:10, borderWidth:1, borderColor:COLORS.border, paddingHorizontal:14, paddingVertical:12, marginBottom:8 },
  travelerName:{ flex:1, color:COLORS.text, fontSize:15 },
  removeBtn:{ color:COLORS.error, fontSize:18, fontWeight:'700' },
  addRow: { flexDirection:'row', gap:8, marginBottom:10 },
  addBtn: { backgroundColor:COLORS.primary, borderRadius:10, paddingHorizontal:18, justifyContent:'center', alignItems:'center' },
  addBtnText:{ color:COLORS.white, fontWeight:'700', fontSize:15 },
  pairRow:  { flexDirection:'row', alignItems:'center', backgroundColor:COLORS.surfaceVariant, borderRadius:10, borderWidth:1, borderColor:COLORS.border, paddingHorizontal:14, paddingVertical:10, marginBottom:8 },
  pairIcon: { fontSize:20, marginRight:10 },
  pairInfo: { flex:1 },
  pairName: { color:COLORS.text, fontSize:15, fontWeight:'600' },
  pairMembers:{ color:COLORS.textSecondary, fontSize:12, marginTop:2 },
  addPairBtn:    { backgroundColor:COLORS.surfaceVariant, borderRadius:10, borderWidth:1, borderColor:COLORS.primary, padding:13, alignItems:'center', marginBottom:8 },
  addPairBtnText:{ color:COLORS.primary, fontWeight:'600', fontSize:15 },
  saveBtn:{ backgroundColor:COLORS.primary, borderRadius:12, padding:16, alignItems:'center', marginTop:24 },
  saveBtnText:{ color:COLORS.white, fontWeight:'700', fontSize:17 },
  overlay:    { flex:1, backgroundColor:'rgba(0,0,0,0.65)', justifyContent:'flex-end' },
  modalSheet: { backgroundColor:COLORS.surface, borderTopLeftRadius:22, borderTopRightRadius:22, padding:20, paddingBottom:40 },
  modalHandle:{ width:38, height:4, backgroundColor:COLORS.border, borderRadius:2, alignSelf:'center', marginBottom:16 },
  modalTitle: { color:COLORS.text, fontSize:18, fontWeight:'700', textAlign:'center', marginBottom:16 },
  modalLabel: { fontSize:12, fontWeight:'700', color:COLORS.textSecondary, textTransform:'uppercase', letterSpacing:0.7, marginTop:14, marginBottom:6 },
  modalInput: { backgroundColor:COLORS.surfaceVariant, borderRadius:10, borderWidth:1, borderColor:COLORS.border, color:COLORS.text, fontSize:15, paddingHorizontal:14, paddingVertical:13 },
  modalSaveBtn:    { backgroundColor:COLORS.primary, borderRadius:12, padding:15, alignItems:'center', marginTop:20 },
  modalSaveBtnText:{ color:COLORS.white, fontWeight:'700', fontSize:16 },
});
