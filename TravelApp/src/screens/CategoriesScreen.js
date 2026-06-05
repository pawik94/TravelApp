import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import { COLORS, CATEGORY_PALETTE } from '../theme';
import { getCategories, insertCategory, updateCategory, deleteCategory } from '../database/db';
import Header from '../components/Header';

export default function CategoriesScreen({ route, navigation }) {
  const { tripId, onBack } = route.params||{};
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => { setCategories(await getCategories(tripId)); };

  const openNew  = () => { setEditing({ name:'', color:CATEGORY_PALETTE[0] }); setShowModal(true); };
  const openEdit = (cat) => { setEditing({ id:cat.id, name:cat.name, color:cat.color }); setShowModal(true); };

  const handleSave = async () => {
    if (!editing?.name?.trim()) { Alert.alert('Błąd','Wpisz nazwę kategorii'); return; }
    if (editing.id) await updateCategory(editing.id, editing.name.trim(), editing.color);
    else            await insertCategory(tripId, editing.name.trim(), editing.color);
    setShowModal(false); setEditing(null); load();
  };

  const handleDelete = (cat) => {
    Alert.alert('Usuń kategorię', `Usunąć "${cat.name}"?`, [
      { text:'Anuluj', style:'cancel' },
      { text:'Usuń', style:'destructive', onPress:async()=>{ await deleteCategory(cat.id); load(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <Header title="Kategorie" showBack onBack={()=>{ onBack&&onBack(); navigation.goBack(); }} />
      <FlatList data={categories} keyExtractor={item=>String(item.id)} contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor:item.color }]} />
            <Text style={styles.catName}>{item.name}</Text>
            <TouchableOpacity style={styles.editBtn} onPress={()=>openEdit(item)} hitSlop={8}><Text style={styles.editText}>✏️</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>handleDelete(item)} hitSlop={8}><Text style={styles.delText}>✕</Text></TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Brak kategorii</Text>}
      />
      <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
      <Modal visible={showModal} transparent animationType="slide" statusBarTranslucent>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={()=>setShowModal(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={()=>true}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{editing?.id?'Edytuj kategorię':'Nowa kategoria'}</Text>
            <View style={styles.previewRow}>
              <View style={[styles.preview, { backgroundColor:editing?.color }]} />
              <TextInput style={styles.nameInput} placeholder="Nazwa kategorii" placeholderTextColor={COLORS.textSecondary}
                value={editing?.name||''} onChangeText={v=>setEditing(e=>({...e,name:v}))} autoFocus />
            </View>
            <Text style={styles.paletteLabel}>Kolor</Text>
            <View style={styles.palette}>
              {CATEGORY_PALETTE.map(color => (
                <TouchableOpacity key={color} style={[styles.swatch,{backgroundColor:color},editing?.color===color&&styles.swatchActive]} onPress={()=>setEditing(e=>({...e,color}))} />
              ))}
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Zapisz</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:COLORS.background },
  list:     { padding:16, paddingBottom:90 },
  row:      { flexDirection:'row', alignItems:'center', backgroundColor:COLORS.surface, borderRadius:12, borderWidth:1, borderColor:COLORS.border, padding:14, marginBottom:8 },
  dot:      { width:14, height:14, borderRadius:7, marginRight:12 },
  catName:  { flex:1, color:COLORS.text, fontSize:16 },
  editBtn:  { marginRight:14 },
  editText: { fontSize:18 },
  delText:  { color:COLORS.error, fontSize:18, fontWeight:'700' },
  empty:    { textAlign:'center', color:COLORS.textSecondary, marginTop:40, fontSize:15 },
  fab:      { position:'absolute', right:20, bottom:28, width:56, height:56, borderRadius:28, backgroundColor:COLORS.primary, alignItems:'center', justifyContent:'center', elevation:8 },
  fabIcon:  { color:COLORS.white, fontSize:30, lineHeight:34 },
  overlay:  { flex:1, backgroundColor:'rgba(0,0,0,0.65)', justifyContent:'flex-end' },
  sheet:    { backgroundColor:COLORS.surface, borderTopLeftRadius:22, borderTopRightRadius:22, padding:20, paddingBottom:40 },
  handle:   { width:38, height:4, backgroundColor:COLORS.border, borderRadius:2, alignSelf:'center', marginBottom:16 },
  sheetTitle:{ color:COLORS.text, fontSize:18, fontWeight:'700', marginBottom:16, textAlign:'center' },
  previewRow:{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:20 },
  preview:   { width:40, height:40, borderRadius:20 },
  nameInput: { flex:1, backgroundColor:COLORS.surfaceVariant, borderRadius:10, borderWidth:1, borderColor:COLORS.border, color:COLORS.text, fontSize:16, paddingHorizontal:14, paddingVertical:12 },
  paletteLabel:{ color:COLORS.textSecondary, fontSize:12, fontWeight:'700', textTransform:'uppercase', letterSpacing:0.7, marginBottom:10 },
  palette:   { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:24 },
  swatch:    { width:36, height:36, borderRadius:18 },
  swatchActive:{ borderWidth:3, borderColor:COLORS.white, transform:[{scale:1.15}] },
  saveBtn:   { backgroundColor:COLORS.primary, borderRadius:12, padding:15, alignItems:'center' },
  saveBtnText:{ color:COLORS.white, fontWeight:'700', fontSize:16 },
});
