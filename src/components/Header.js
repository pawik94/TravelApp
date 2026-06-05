import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { COLORS } from '../theme';
export default function Header({ title, showBack=false, onBack, right=null }) {
  const PT = Platform.OS==='android' ? (StatusBar.currentHeight||28) : 44;
  return (
    <View style={[styles.container, { paddingTop: PT+8 }]}>
      <View style={styles.left}>
        {showBack && onBack && (
          <TouchableOpacity onPress={onBack} hitSlop={16}>
            <Text style={styles.backText}>‹ Wróć</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.right}>{right||null}</View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { backgroundColor:COLORS.surface, paddingBottom:12, paddingHorizontal:16, flexDirection:'row', alignItems:'center', borderBottomWidth:1, borderBottomColor:COLORS.border },
  left:  { width:70 },
  right: { width:70, alignItems:'flex-end' },
  title: { flex:1, color:COLORS.text, fontSize:17, fontWeight:'600', textAlign:'center' },
  backText: { color:COLORS.primary, fontSize:16 },
});
