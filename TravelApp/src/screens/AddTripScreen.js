import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, CURRENCIES } from '../theme';
import { getTripById, getTravelers, insertTrip, updateTrip, insertTraveler, deleteTraveler } from '../database/db';
import { formatDate } from '../utils/currency';
import Header from '../components/Header';
import ModalPicker from '../components/ModalPicker';

export default function AddTripScreen({ navigation, route }) {
  const { tripId:editId, onBack } = route.params||{};
  const [name,setName]=useState(''); const [destination,setDestination]=useState('');
  const [startDate,setStartDate]=useState(''); const [endDate,setEndDate]=useState('');
  const [comment,setComment]=useState(''); const [defaultCurrency,setDefaultCurrency]=useState('EUR');
  const [travelers,setTravelers]=useState([]); const [newTraveler,setNewTraveler]=useState('');
  const [showStart,setShowStart]=useState(false); const [showEnd,setShowEnd]=useState(false);

  useEffect(() => { if (editId) loadTrip(); }, [editId]);

  const loadTrip = async () => {
    const trip = await getTripById(editId);
    if (!trip) return;
    setName(trip.name); setDestination(trip.destination||'');
    setStartDate(trip.start_date||''); setEndDate(trip.end_date||'');
    setComment(trip.comment||''); setDefaultCurrency(trip.default_currency||'EUR');
    setTravelers(await getTravelers(editId));
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Błąd','Wpisz nazwę podróży'); return; }
    const tripData = { name:name.trim(), destination:destination.trim(), start_date:startDate, end_date:endDate, comment:comment.trim(), default_currency:defaultCurrency };
    if (editId) {
      await updateTrip({ ...tripData, id:editId });
      onBack && onBack(); navigation.goBack();
    } else {
      const tripId = await insertTrip(tripData);
      for (const t of travelers) await insertTraveler(tripId, t.name);
      onBack && onBack();
      navigation.replace('Trip', { tripId, tripName:tripData.name });
    }
  };

  const addTraveler = () => {
    const n = newTraveler.trim(); if (!n) return; setNewTraveler('');
    if (editId) { insertTraveler(editId, n).then(id => setTravelers(prev=>[...prev,{id,name:n}])); }
    else        { setTravelers(prev=>[...prev,{id:-Date.now(),name:n}]); }
  };

  const removeTraveler = async (t) => {
    if (editId && t.id>0) await deleteTraveler(t.id);
    setTravelers(prev=>prev.filter(x=>x.id!==t.id));
  };

  return (
    <KeyboardAvoidingView style={{flex:1,backgroundColor:COLORS.background}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <Header title={editId?'Edytuj Podróż':'Nowa Podróż'} showBack onBack={()=>{onBack&&onBack();navigation.goBack();}} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Szczegóły podróży</Text>
        <TextInput style={styles.input} placeholder="Nazwa podróży *" placeholderTextColor={COLORS.textSecondary} value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Cel podróży (np. Islandia)" placeholderTextColor={COLORS.textSecondary} value={destination} onChangeText={setDestination} />
        <View style={styles.row}>
          <TouchableOpacity style={[styles.dateBtn,{flex:1,marginRight:8}]} onPress={()=>setShowStart(true)}>
            <Text style={styles.dateLbl}>Od</Text>
            <Text style={[styles.dateVal,!startDate&&styles.datePlaceholder]}>{startDate?formatDate(startDate):'Wybierz'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dateBtn,{flex:1}]} onPress={()=>setShowEnd(true)}>
            <Text style={styles.dateLbl}>Do</Text>
            <Text style={[styles.dateVal,!endDate&&styles.datePlaceholder]}>{endDate?formatDate(endDate):'Wybierz'}</Text>
          </TouchableOpacity>
        </View>
        {showStart && <DateTimePicker value={startDate?new Date(startDate):new Date()} mode="date" display="default" onChange={(_,d)=>{setShowStart(false);if(d)setStartDate(d.toISOString().split('T')[0]);}} />}
        {showEnd   && <DateTimePicker value={endDate?new Date(endDate):new Date()}     mode="date" display="default" onChange={(_,d)=>{setShowEnd(false);  if(d)setEndDate(d.toISOString().split('T')[0]);}} />}
        <TextInput style={[styles.input,{height:70,textAlignVertical:'top'}]} placeholder="Komentarz" placeholderTextColor={COLORS.textSecondary} value={comment} onChangeText={setComment} multiline />

        <Text style={styles.section}>Domyślna waluta</Text>
        <ModalPicker value={defaultCurrency} options={CURRENCIES.map(c=>({label:c,value:c}))} onChange={setDefaultCurrency} title="Domyślna waluta" />

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
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{editId?'Zapisz zmiany':'Utwórz podróż'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  content:{ padding:16, paddingBottom:40 },
  section:{ fontSize:12, fontWeight:'700', color:COLORS.textSecondary, textTransform:'uppercase', letterSpacing:0.8, marginTop:20, marginBottom:10 },
  input:  { backgroundColor:COLORS.surfaceVariant, borderRadius:10, borderWidth:1, borderColor:COLORS.border, color:COLORS.text, fontSize:15, paddingHorizontal:14, paddingVertical:13, marginBottom:10 },
  row:    { flexDirection:'row', marginBottom:10 },
  dateBtn:{ backgroundColor:COLORS.surfaceVariant, borderRadius:10, borderWidth:1, borderColor:COLORS.border, padding:12 },
  dateLbl:{ fontSize:11, color:COLORS.textSecondary, marginBottom:2 },
  dateVal:{ fontSize:15, color:COLORS.text, fontWeight:'500' },
  datePlaceholder:{ color:COLORS.textSecondary, fontWeight:'400' },
  travelerRow:{ flexDirection:'row', alignItems:'center', backgroundColor:COLORS.surfaceVariant, borderRadius:10, borderWidth:1, borderColor:COLORS.border, paddingHorizontal:14, paddingVertical:12, marginBottom:8 },
  travelerName:{ flex:1, color:COLORS.text, fontSize:15 },
  removeBtn:{ color:COLORS.error, fontSize:18, fontWeight:'700' },
  addRow: { flexDirection:'row', gap:8, marginBottom:10 },
  addBtn: { backgroundColor:COLORS.primary, borderRadius:10, paddingHorizontal:18, justifyContent:'center', alignItems:'center' },
  addBtnText:{ color:COLORS.white, fontWeight:'700', fontSize:15 },
  saveBtn:{ backgroundColor:COLORS.primary, borderRadius:12, padding:16, alignItems:'center', marginTop:24 },
  saveBtnText:{ color:COLORS.white, fontWeight:'700', fontSize:17 },
});
