import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { COLORS } from '../theme';
export default function ModalPicker({ value, options, onChange, placeholder='Wybierz...', title }) {
  const [visible, setVisible] = useState(false);
  const selected = options.find(o => String(o.value)===String(value));
  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setVisible(true)} activeOpacity={0.7}>
        <View style={styles.triggerInner}>
          {selected?.color && <View style={[styles.dot, { backgroundColor:selected.color }]} />}
          <Text style={selected ? styles.triggerText : styles.placeholder} numberOfLines={1}>
            {selected ? selected.label : placeholder}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />
            {title ? <Text style={styles.sheetTitle}>{title}</Text> : null}
            <FlatList
              data={options}
              keyExtractor={item => String(item.value)}
              renderItem={({ item }) => {
                const isActive = String(item.value)===String(value);
                return (
                  <TouchableOpacity style={[styles.option, isActive && styles.optionActive]} onPress={() => { onChange(item.value); setVisible(false); }} activeOpacity={0.7}>
                    {item.color && <View style={[styles.optDot, { backgroundColor:item.color }]} />}
                    <Text style={[styles.optionText, isActive && styles.optionTextActive]}>{item.label}</Text>
                    {isActive && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setVisible(false)}>
              <Text style={styles.cancelText}>Anuluj</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  trigger:      { flexDirection:'row', alignItems:'center', backgroundColor:COLORS.surfaceVariant, borderRadius:10, paddingVertical:13, paddingHorizontal:14, borderWidth:1, borderColor:COLORS.border },
  triggerInner: { flex:1, flexDirection:'row', alignItems:'center' },
  dot:          { width:10, height:10, borderRadius:5, marginRight:8 },
  triggerText:  { color:COLORS.text, fontSize:15 },
  placeholder:  { color:COLORS.textSecondary, fontSize:15 },
  chevron:      { color:COLORS.textSecondary, fontSize:22, marginLeft:4 },
  overlay:      { flex:1, backgroundColor:'rgba(0,0,0,0.65)', justifyContent:'flex-end' },
  sheet:        { backgroundColor:COLORS.surface, borderTopLeftRadius:22, borderTopRightRadius:22, maxHeight:'65%', paddingBottom:24 },
  handle:       { width:38, height:4, backgroundColor:COLORS.border, borderRadius:2, alignSelf:'center', marginTop:12, marginBottom:6 },
  sheetTitle:   { color:COLORS.textSecondary, fontSize:13, textAlign:'center', marginBottom:8, letterSpacing:0.5, textTransform:'uppercase' },
  option:       { flexDirection:'row', alignItems:'center', paddingVertical:15, paddingHorizontal:20, borderBottomWidth:1, borderBottomColor:COLORS.border },
  optionActive: { backgroundColor:COLORS.surfaceVariant },
  optDot:       { width:12, height:12, borderRadius:6, marginRight:12 },
  optionText:      { flex:1, color:COLORS.text, fontSize:16 },
  optionTextActive:{ color:COLORS.primary, fontWeight:'700' },
  check:    { color:COLORS.primary, fontSize:18 },
  cancelBtn:    { margin:16, marginTop:8, backgroundColor:COLORS.surfaceVariant, borderRadius:12, paddingVertical:14, alignItems:'center' },
  cancelText:   { color:COLORS.text, fontSize:16, fontWeight:'600' },
});
