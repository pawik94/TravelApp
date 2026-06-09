import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView, Share, Modal, TextInput, Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS } from '../theme';
import {
  getExpenses, deleteExpense, getTravelers, getCategories,
  getExpensesForSettlement, exportTripCSV,
  getPayments, insertPayment, deletePayment, updatePayment, getPairs,
} from '../database/db';
import { formatPLN, formatAmount, formatDate, todayStr } from '../utils/currency';

const dayLabel = (dateStr) => {
  const today = todayStr();
  const d = new Date(Date.now() - 86400000);
  const yesterday = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  if (dateStr === today) return 'Dziś';
  if (dateStr === yesterday) return 'Wczoraj';
  return formatDate(dateStr);
};
import { calculateSettlement } from '../utils/settlement';
import Header from '../components/Header';
import { exportTripJSON } from '../utils/backup';
import ModalPicker from '../components/ModalPicker';

const TABS = ['Wydatki', 'Podsumowanie', 'Rozliczenie'];

export default function TripScreen({ navigation, route }) {
  const { tripId, tripName } = route.params;
  const [tab,        setTab]        = useState(0);
  const [expenses,   setExpenses]   = useState([]);
  const [travelers,  setTravelers]  = useState([]);
  const [categories, setCategories] = useState([]);
  const [pairs,      setPairs]      = useState([]);
  const [filterTvl,  setFilterTvl]  = useState(null);
  const [filterCat,  setFilterCat]  = useState(null);
  const [settlement, setSettlement] = useState(null);
  const [payments,   setPayments]   = useState([]);
  const [tick,       setTick]       = useState(0);

  // Payment modal
  const [showPayModal,  setShowPayModal]  = useState(false);
  const [payFrom,       setPayFrom]       = useState(null);
  const [payTo,         setPayTo]         = useState(null);
  const [payAmount,     setPayAmount]     = useState('');
  const [payDate,       setPayDate]       = useState(todayStr());
  const [payNote,       setPayNote]       = useState('');
  const [payForPair,    setPayForPair]    = useState(false);
  const [payPairId,     setPayPairId]     = useState(null);
  const [showPayDate,   setShowPayDate]   = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);

  const loadAll = useCallback(async () => {
    const [tvl, cats, pymnts, prs] = await Promise.all([
      getTravelers(tripId), getCategories(tripId),
      getPayments(tripId), getPairs(tripId),
    ]);
    setTravelers(tvl); setCategories(cats); setPayments(pymnts); setPairs(prs);
    const exps = await getExpenses(tripId, { travelerId:filterTvl, categoryId:filterCat });
    setExpenses(exps);
    const settleExps = await getExpensesForSettlement(tripId);
    if (tvl.length>0) setSettlement(calculateSettlement(tvl, settleExps, pymnts));
  }, [tripId, filterTvl, filterCat]);

  useEffect(() => { loadAll(); }, [loadAll, tick]);

  const handleExport = () => {
    Alert.alert(
      'Eksport danych',
      'Wybierz format eksportu:',
      [
        {
          text: '📊 CSV (tabela wydatków)',
          onPress: async () => {
            const csv = await exportTripCSV(tripId);
            await Share.share({ message: csv, title: `Wydatki - ${tripName}` });
          },
        },
        {
          text: '💾 JSON (pełna kopia zapasowa)',
          onPress: async () => {
            await exportTripJSON(tripId, tripName);
          },
        },
        { text: 'Anuluj', style: 'cancel' },
      ]
    );
  };

  const handleDeleteExpense = (exp) => {
    Alert.alert('Usuń wydatek','Usunąć ten wydatek?',[
      {text:'Anuluj',style:'cancel'},
      {text:'Usuń',style:'destructive',onPress:async()=>{await deleteExpense(exp.id);loadAll();}},
    ]);
  };

  const openPayModal = () => {
    setEditingPayment(null);
    setPayFrom(travelers[0]?.id||null);
    setPayTo(travelers[1]?.id||null);
    setPayAmount(''); setPayDate(todayStr()); setPayNote('');
    setPayForPair(false); setPayPairId(pairs[0]?.id||null);
    setShowPayModal(true);
  };

  const openEditPayModal = (p) => {
    setEditingPayment(p);
    setPayFrom(p.from_traveler);
    setPayTo(p.to_traveler);
    setPayAmount(String(p.amount));
    setPayDate(p.date);
    setPayNote(p.note||'');
    setPayForPair(!!p.on_behalf_pair);
    setPayPairId(p.on_behalf_pair||pairs[0]?.id||null);
    setShowPayModal(true);
  };

  const handleSavePayment = async () => {
    if (!payFrom||!payTo)               {Alert.alert('Błąd','Wybierz osoby');return;}
    if (payFrom===payTo)                {Alert.alert('Błąd','Nie możesz przelać sam sobie');return;}
    const amt=parseFloat(payAmount);
    if (isNaN(amt)||amt<=0)             {Alert.alert('Błąd','Wpisz kwotę');return;}
    if (payForPair&&!payPairId)         {Alert.alert('Błąd','Wybierz parę');return;}

    const selectedPair = payForPair ? pairs.find(p=>p.id===payPairId) : null;

    if (editingPayment) {
      await updatePayment({
        id: editingPayment.id,
        from_traveler:payFrom, to_traveler:payTo,
        amount:amt, date:payDate, note:payNote.trim(),
        on_behalf_pair: payForPair ? payPairId : null,
      });
    } else {
      await insertPayment({
        trip_id:tripId, from_traveler:payFrom, to_traveler:payTo,
        amount:amt, date:payDate, note:payNote.trim(),
        on_behalf_pair: payForPair ? payPairId : null,
      });
    }
    setEditingPayment(null);
    setShowPayModal(false);
    loadAll();
  };

  const handlePaymentLongPress = (p) => {
    Alert.alert(
      'Płatność',
      formatPLN(p.amount)+' · '+p.from_name+' → '+p.to_name,
      [
        {text:'✏️ Edytuj', onPress:()=>openEditPayModal(p)},
        {text:'🗑️ Usuń', style:'destructive', onPress:async()=>{await deletePayment(p.id);loadAll();}},
        {text:'Anuluj', style:'cancel'},
      ]
    );
  };

  const handleQuickPay = async (tx) => {
    await insertPayment({
      trip_id:tripId, from_traveler:tx.fromId, to_traveler:tx.toId,
      amount:tx.amount, date:todayStr(), note:'', on_behalf_pair:null,
    });
    loadAll();
  };

  const RightButtons = () => (
    <View style={{flexDirection:'row',gap:10}}>
      <TouchableOpacity onPress={()=>navigation.navigate('AddTrip',{tripId,onBack:()=>setTick(t=>t+1)})} hitSlop={8}><Text style={{fontSize:18}}>⚙️</Text></TouchableOpacity>
      <TouchableOpacity onPress={()=>navigation.navigate('Categories',{tripId,onBack:()=>setTick(t=>t+1)})} hitSlop={8}><Text style={{fontSize:18}}>🏷️</Text></TouchableOpacity>
      <TouchableOpacity onPress={handleExport} hitSlop={8}><Text style={{fontSize:18}}>📤</Text></TouchableOpacity>
    </View>
  );

  const renderExpenseItem = (item) => (
    <TouchableOpacity key={item.id} style={styles.expCard}
      onPress={()=>navigation.navigate('AddExpense',{tripId,expenseId:item.id,onBack:loadAll})}
      onLongPress={()=>handleExpenseLongPress(item)} activeOpacity={0.75}>
      <View style={styles.expLeft}>
        <View style={[styles.catDot,{backgroundColor:item.category_color||COLORS.border}]}/>
        <View style={styles.expInfo}>
          <Text style={styles.expComment} numberOfLines={1}>{item.comment||item.category_name||'—'}</Text>
          <Text style={styles.expMeta}>{item.payer_name}  ·  {item.method}</Text>
          {item.category_name?<Text style={[styles.expCatTag,{color:item.category_color||COLORS.textSecondary}]}>{item.category_name}</Text>:null}
        </View>
      </View>
      <View style={styles.expRight}>
        <Text style={styles.expAmountPLN}>{formatPLN(item.amount_pln)}</Text>
        {item.currency!=='PLN'?<Text style={styles.expAmountOrig}>{formatAmount(item.amount,item.currency)}</Text>:null}
        <View style={[styles.sharedBadge,{backgroundColor:item.is_shared?COLORS.surfaceVariant:'#3a2a1a'}]}>
          <Text style={[styles.sharedText,{color:item.is_shared?COLORS.textSecondary:COLORS.warning}]}>
            {item.is_shared?'wspólny':'wybrani'}
          </Text>
        </View>
        <TouchableOpacity style={styles.copyBtn}
          onPress={()=>navigation.navigate('AddExpense',{tripId,copyFromId:item.id,onBack:loadAll})}
          hitSlop={6}>
          <Text style={styles.copyBtnTxt}>📋</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // ── TAB: Wydatki ──────────────────────────────────────────────────────────
  const WydatkiTab = () => (
    <View style={{flex:1}}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterContent}>
        <TouchableOpacity style={[styles.chip,!filterTvl&&!filterCat&&styles.chipActive]} onPress={()=>{setFilterTvl(null);setFilterCat(null);}}>
          <Text style={[styles.chipText,!filterTvl&&!filterCat&&styles.chipTextActive]}>Wszyscy</Text>
        </TouchableOpacity>
        {travelers.map(t=>(
          <TouchableOpacity key={t.id} style={[styles.chip,filterTvl===t.id&&styles.chipActive]} onPress={()=>{setFilterTvl(filterTvl===t.id?null:t.id);setFilterCat(null);}}>
            <Text style={[styles.chipText,filterTvl===t.id&&styles.chipTextActive]}>👤 {t.name}</Text>
          </TouchableOpacity>
        ))}
        {categories.map(c=>(
          <TouchableOpacity key={c.id} style={[styles.chip,filterCat===c.id&&styles.chipActive,{borderColor:c.color}]} onPress={()=>{setFilterCat(filterCat===c.id?null:c.id);setFilterTvl(null);}}>
            <Text style={[styles.chipText,filterCat===c.id&&{color:c.color}]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.totalBar}>
        <Text style={styles.totalLabel}>{expenses.length} wydatków</Text>
        <Text style={styles.totalAmount}>{formatPLN(expenses.reduce((s,e)=>s+e.amount_pln,0))}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.expList}>
        {expenses.length===0 && <Text style={styles.emptyText}>Brak wydatków</Text>}
        {(() => {
          const groups = {};
          expenses.forEach(e => { if (!groups[e.date]) groups[e.date]=[]; groups[e.date].push(e); });
          return Object.keys(groups).sort((a,b)=>b.localeCompare(a)).map(date => (
            <View key={date}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayHeaderTxt}>{dayLabel(date)}</Text>
                <Text style={styles.dayHeaderTotal}>{formatPLN(groups[date].reduce((s,e)=>s+e.amount_pln,0))}</Text>
              </View>
              {groups[date].map(item => renderExpenseItem(item))}
            </View>
          ));
        })()}
      </ScrollView>
    </View>
  );

  // ── TAB: Podsumowanie ─────────────────────────────────────────────────────
  const SummaryTab = () => {
    const perPerson = travelers.map(t=>({...t,paid:expenses.filter(e=>e.paid_by===t.id).reduce((s,e)=>s+e.amount_pln,0)}));
    const catMap={};
    expenses.forEach(e=>{
      const key=e.category_name||'Bez kategorii';
      if(!catMap[key]) catMap[key]={name:key,color:e.category_color||COLORS.textSecondary,total:0};
      catMap[key].total+=e.amount_pln;
    });
    // Payment effects: +made -received
    const payEff={};
    travelers.forEach(t=>{payEff[t.id]=0;});
    payments.forEach(p=>{
      if(payEff[p.from_traveler]!==undefined) payEff[p.from_traveler]+=parseFloat(p.amount);
      if(payEff[p.to_traveler]!==undefined)   payEff[p.to_traveler]  -=parseFloat(p.amount);
    });
    return (
      <ScrollView contentContainerStyle={styles.summaryContent}>
        <Text style={styles.summaryHeader}>Suma całkowita</Text>
        <Text style={styles.grandTotal}>{formatPLN(expenses.reduce((s,e)=>s+e.amount_pln,0))}</Text>
        <Text style={styles.summaryHeader}>Według osoby (po rozliczeniach)</Text>
        {perPerson.map(p=>{
          const eff=payEff[p.id]||0;
          const effective=p.paid+eff;
          return (
            <View key={p.id} style={styles.summaryRow}>
              <Text style={styles.summaryName}>👤 {p.name}</Text>
              <View style={{alignItems:'flex-end'}}>
                <Text style={styles.summaryValue}>{formatPLN(effective)}</Text>
                {Math.abs(eff)>0.005&&(
                  <Text style={styles.summaryAdjust}>
                    {'wydatki '+formatPLN(p.paid)+(eff>0?' +zwroty '+formatPLN(eff):' −zwroty '+formatPLN(-eff))}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
        <Text style={styles.summaryHeader}>Według kategorii</Text>
        {Object.values(catMap).sort((a,b)=>b.total-a.total).map((c,i)=>(
          <View key={i} style={styles.summaryRow}>
            <View style={[styles.catDotSm,{backgroundColor:c.color}]}/>
            <Text style={styles.summaryName}>{c.name}</Text>
            <Text style={styles.summaryValue}>{formatPLN(c.total)}</Text>
          </View>
        ))}
      </ScrollView>
    );
  };

  // ── TAB: Rozliczenie ─────────────────────────────────────────────────────
  const RozliczenieTab = () => {
    if (!settlement) return <Text style={styles.emptyText}>Brak danych</Text>;
    const {balances,transactions} = settlement;
    return (
      <ScrollView contentContainerStyle={styles.summaryContent}>
        <Text style={styles.summaryHeader}>Bilans</Text>
        {balances.map(b=>{
          const color=b.net>0.005?COLORS.success:b.net<-0.005?COLORS.error:COLORS.textSecondary;
          return (
            <View key={b.id} style={styles.balanceRow}>
              <Text style={styles.balanceName}>👤 {b.name}</Text>
              <View style={{marginTop:4}}>
                <Text style={styles.balanceSub}>Zapłacił wydatki: {formatPLN(b.paid)}</Text>
                <Text style={styles.balanceSub}>Powinien: {formatPLN(b.shouldPay)}</Text>
                <Text style={[styles.balanceNet,{color}]}>
                  {b.net>0.005?'▲ należy mu się '+formatPLN(Math.abs(b.net)):
                   b.net<-0.005?'▼ powinien oddać '+formatPLN(Math.abs(b.net)):'✓ rozliczony'}
                </Text>
              </View>
            </View>
          );
        })}

        <Text style={styles.summaryHeader}>Co należy zrobić</Text>
        {transactions.length===0
          ?<View style={styles.settledBox}><Text style={styles.settledText}>✅ Wszyscy są rozliczeni!</Text></View>
          :transactions.map((tx,i)=>(
            <View key={i} style={styles.txRow}>
              <View style={styles.txInfo}>
                <View style={styles.txNames}>
                  <Text style={styles.txFrom}>{tx.from}</Text>
                  <Text style={styles.txArrow}> → </Text>
                  <Text style={styles.txTo}>{tx.to}</Text>
                </View>
                <Text style={styles.txAmount}>{formatPLN(tx.amount)}</Text>
              </View>
              <TouchableOpacity style={styles.txPayBtn} onPress={()=>handleQuickPay(tx)} activeOpacity={0.75}>
                <Text style={styles.txPayBtnText}>✓ Zrealizuj</Text>
              </TouchableOpacity>
            </View>
          ))
        }

        <TouchableOpacity style={styles.addPayBtn} onPress={openPayModal}>
          <Text style={styles.addPayBtnText}>+ Zarejestruj płatność</Text>
        </TouchableOpacity>

        {payments.length>0 && (
          <>
            <Text style={styles.summaryHeader}>Historia płatności</Text>
            {payments.map(p=>(
              <TouchableOpacity key={p.id} style={styles.payRow} onLongPress={()=>handlePaymentLongPress(p)} activeOpacity={0.75}>
                <View style={styles.payLeft}>
                  <Text style={styles.payNames}>
                    {p.from_name} → {p.to_name}
                    {p.pair_name?'  (za parę: '+p.pair_name+')':''}
                  </Text>
                  <Text style={styles.payDate}>{formatDate(p.date)}{p.note?'  ·  '+p.note:''}</Text>
                </View>
                <Text style={styles.payAmount}>{formatPLN(p.amount)}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.payHint}>Przytrzymaj płatność aby edytować lub usunąć</Text>
          </>
        )}
      </ScrollView>
    );
  };

  const travelerOptions = travelers.map(t=>({label:t.name,value:t.id}));
  const pairOptions     = pairs.map(p=>({label:p.name,value:p.id}));

  return (
    <View style={styles.container}>
      <Header title={tripName} showBack onBack={()=>navigation.goBack()} right={<RightButtons/>}/>
      <View style={styles.tabBar}>
        {TABS.map((t,i)=>(
          <TouchableOpacity key={i} style={[styles.tabBtn,tab===i&&styles.tabBtnActive]} onPress={()=>setTab(i)}>
            <Text style={[styles.tabText,tab===i&&styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab===0&&<WydatkiTab/>}
      {tab===1&&<SummaryTab/>}
      {tab===2&&<RozliczenieTab/>}

      {tab===0&&(
        <TouchableOpacity style={styles.fab} onPress={()=>navigation.navigate('AddExpense',{tripId,onBack:()=>setTick(t=>t+1)})} activeOpacity={0.85}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}

      {/* ── Payment Modal ── */}
      <Modal visible={showPayModal} transparent animationType="slide" statusBarTranslucent>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={()=>setShowPayModal(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={()=>true}>
            <View style={styles.modalHandle}/>
            <Text style={styles.modalTitle}>{editingPayment?'Edytuj płatność':'Zarejestruj płatność'}</Text>

            <Text style={styles.modalLabel}>Kto płaci</Text>
            <ModalPicker value={payFrom} options={travelerOptions} onChange={setPayFrom} placeholder="Wybierz..." title="Kto płaci"/>

            <Text style={styles.modalLabel}>Komu</Text>
            <ModalPicker value={payTo} options={travelerOptions} onChange={setPayTo} placeholder="Wybierz..." title="Komu"/>

            <Text style={styles.modalLabel}>Kwota (PLN)</Text>
            <TextInput style={styles.modalInput} placeholder="0.00" placeholderTextColor={COLORS.textSecondary} value={payAmount} onChangeText={setPayAmount} keyboardType="decimal-pad"/>

            <Text style={styles.modalLabel}>Data</Text>
            <TouchableOpacity style={styles.modalInput} onPress={()=>setShowPayDate(true)}>
              <Text style={{color:COLORS.text,fontSize:15}}>{formatDate(payDate)}</Text>
            </TouchableOpacity>
            {showPayDate&&<DateTimePicker value={new Date(payDate)} mode="date" display="default" onChange={(_,d)=>{setShowPayDate(false);if(d)setPayDate(d.toISOString().split('T')[0]);}}/>}

            {/* Pair payment toggle */}
            {pairs.length>0 && (
              <View style={styles.pairPayRow}>
                <View>
                  <Text style={styles.pairPayLabel}>Płatność za parę</Text>
                  <Text style={styles.pairPayHint}>Rozliczy obie osoby z pary</Text>
                </View>
                <Switch value={payForPair} onValueChange={setPayForPair} trackColor={{false:COLORS.border,true:COLORS.primary}} thumbColor={COLORS.white}/>
              </View>
            )}
            {payForPair && pairs.length>0 && (
              <>
                <Text style={styles.modalLabel}>Która para</Text>
                <ModalPicker value={payPairId} options={pairOptions} onChange={setPayPairId} placeholder="Wybierz parę..." title="Para"/>
              </>
            )}

            <Text style={styles.modalLabel}>Notatka (opcjonalnie)</Text>
            <TextInput style={styles.modalInput} placeholder="np. zwrot za hotel" placeholderTextColor={COLORS.textSecondary} value={payNote} onChangeText={setPayNote}/>

            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSavePayment}>
              <Text style={styles.modalSaveBtnText}>Zapisz płatność</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    {flex:1,backgroundColor:COLORS.background},
  tabBar:       {flexDirection:'row',backgroundColor:COLORS.surface,borderBottomWidth:1,borderBottomColor:COLORS.border},
  tabBtn:       {flex:1,paddingVertical:14,alignItems:'center'},
  tabBtnActive: {borderBottomWidth:2,borderBottomColor:COLORS.primary},
  tabText:      {color:COLORS.textSecondary,fontSize:14,fontWeight:'600'},
  tabTextActive:{color:COLORS.primary},
  filterBar:    {maxHeight:48,backgroundColor:COLORS.surface,borderBottomWidth:1,borderBottomColor:COLORS.border},
  filterContent:{flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingVertical:8,gap:8},
  chip:         {paddingHorizontal:12,paddingVertical:6,borderRadius:20,backgroundColor:COLORS.surfaceVariant,borderWidth:1,borderColor:COLORS.border},
  chipActive:   {backgroundColor:COLORS.primary,borderColor:COLORS.primary},
  chipText:     {color:COLORS.textSecondary,fontSize:13,fontWeight:'500'},
  chipTextActive:{color:COLORS.white},
  totalBar:     {flexDirection:'row',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:10,backgroundColor:COLORS.surfaceVariant,borderBottomWidth:1,borderBottomColor:COLORS.border},
  totalLabel:   {color:COLORS.textSecondary,fontSize:13},
  totalAmount:  {color:COLORS.primary,fontSize:15,fontWeight:'700'},
  expList:      {padding:12,paddingBottom:90},
  expCard:      {backgroundColor:COLORS.surface,borderRadius:12,padding:14,marginBottom:8,flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',borderWidth:1,borderColor:COLORS.border},
  expLeft:      {flex:1,flexDirection:'row',alignItems:'flex-start'},
  catDot:       {width:10,height:10,borderRadius:5,marginTop:5,marginRight:10},
  expInfo:      {flex:1},
  expComment:   {color:COLORS.text,fontSize:15,fontWeight:'600',marginBottom:3},
  expMeta:      {color:COLORS.textSecondary,fontSize:12},
  expCatTag:    {fontSize:11,marginTop:3},
  expRight:     {alignItems:'flex-end',marginLeft:8},
  expAmountPLN: {color:COLORS.text,fontSize:15,fontWeight:'700'},
  expAmountOrig:{color:COLORS.textSecondary,fontSize:12,marginTop:2},
  sharedBadge:  {borderRadius:6,paddingHorizontal:6,paddingVertical:2,marginTop:4},
  sharedText:   {fontSize:10,fontWeight:'600'},
  emptyText:    {textAlign:'center',color:COLORS.textSecondary,marginTop:40,fontSize:15},
  summaryContent:{padding:16,paddingBottom:40},
  summaryHeader: {fontSize:11,fontWeight:'700',color:COLORS.textSecondary,textTransform:'uppercase',letterSpacing:0.8,marginTop:20,marginBottom:10},
  grandTotal:    {fontSize:36,fontWeight:'800',color:COLORS.primary,marginBottom:8},
  summaryRow:    {flexDirection:'row',alignItems:'center',paddingVertical:12,borderBottomWidth:1,borderBottomColor:COLORS.border},
  catDotSm:      {width:10,height:10,borderRadius:5,marginRight:10},
  summaryName:   {flex:1,color:COLORS.text,fontSize:15},
  summaryValue:  {color:COLORS.text,fontSize:15,fontWeight:'700'},
  summaryAdjust: {color:COLORS.textSecondary,fontSize:11,marginTop:1},
  balanceRow:    {backgroundColor:COLORS.surface,borderRadius:12,padding:14,marginBottom:10,borderWidth:1,borderColor:COLORS.border},
  balanceName:   {color:COLORS.text,fontSize:15,fontWeight:'600'},
  balanceSub:    {color:COLORS.textSecondary,fontSize:12,marginBottom:2},
  balanceNet:    {fontSize:13,fontWeight:'700',marginTop:4},
  settledBox:    {backgroundColor:COLORS.surfaceVariant,borderRadius:12,padding:20,alignItems:'center'},
  settledText:   {color:COLORS.success,fontSize:16,fontWeight:'700'},
  txRow:        {backgroundColor:COLORS.surface,borderRadius:12,padding:14,marginBottom:10,borderWidth:1,borderColor:COLORS.border},
  txInfo:       {flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10},
  txNames:      {flexDirection:'row',alignItems:'center',flex:1,flexWrap:'wrap'},
  txFrom:       {color:COLORS.error,fontSize:14,fontWeight:'600'},
  txAmount:     {color:COLORS.text,fontSize:14,fontWeight:'700'},
  txArrow:      {color:COLORS.textSecondary,fontSize:15,marginHorizontal:4},
  txTo:         {color:COLORS.success,fontSize:14,fontWeight:'600'},
  txPayBtn:     {backgroundColor:COLORS.primary,borderRadius:8,paddingVertical:9,alignItems:'center'},
  txPayBtnText: {color:COLORS.white,fontWeight:'700',fontSize:14},
  addPayBtn:     {backgroundColor:COLORS.surfaceVariant,borderRadius:12,borderWidth:1,borderColor:COLORS.primary,padding:14,alignItems:'center',marginTop:16},
  addPayBtnText: {color:COLORS.primary,fontWeight:'700',fontSize:15},
  payRow:   {flexDirection:'row',alignItems:'center',backgroundColor:COLORS.surface,borderRadius:12,padding:14,marginBottom:8,borderWidth:1,borderColor:COLORS.border},
  payLeft:  {flex:1},
  payNames: {color:COLORS.text,fontSize:14,fontWeight:'600'},
  payDate:  {color:COLORS.textSecondary,fontSize:12,marginTop:2},
  payAmount:{color:COLORS.secondary,fontSize:15,fontWeight:'700'},
  payHint:  {color:COLORS.textSecondary,fontSize:11,textAlign:'center',marginTop:8},
  fab:      {position:'absolute',right:20,bottom:28,width:58,height:58,borderRadius:29,backgroundColor:COLORS.primary,alignItems:'center',justifyContent:'center',elevation:8},
  fabIcon:  {color:COLORS.white,fontSize:32,lineHeight:36},
  overlay:    {flex:1,backgroundColor:'rgba(0,0,0,0.65)',justifyContent:'flex-end'},
  modalSheet: {backgroundColor:COLORS.surface,borderTopLeftRadius:22,borderTopRightRadius:22,padding:20,paddingBottom:40},
  modalHandle:{width:38,height:4,backgroundColor:COLORS.border,borderRadius:2,alignSelf:'center',marginBottom:16},
  modalTitle: {color:COLORS.text,fontSize:18,fontWeight:'700',textAlign:'center',marginBottom:16},
  modalLabel: {fontSize:12,fontWeight:'700',color:COLORS.textSecondary,textTransform:'uppercase',letterSpacing:0.7,marginTop:14,marginBottom:6},
  modalInput: {backgroundColor:COLORS.surfaceVariant,borderRadius:10,borderWidth:1,borderColor:COLORS.border,color:COLORS.text,fontSize:15,paddingHorizontal:14,paddingVertical:13},
  modalSaveBtn:    {backgroundColor:COLORS.primary,borderRadius:12,padding:15,alignItems:'center',marginTop:20},
  modalSaveBtnText:{color:COLORS.white,fontWeight:'700',fontSize:16},
  pairPayRow:  {flexDirection:'row',justifyContent:'space-between',alignItems:'center',backgroundColor:COLORS.surfaceVariant,borderRadius:10,borderWidth:1,borderColor:COLORS.border,padding:14,marginTop:14},
  pairPayLabel:{color:COLORS.text,fontSize:15,fontWeight:'500'},
  pairPayHint: {color:COLORS.textSecondary,fontSize:12,marginTop:2},
});
