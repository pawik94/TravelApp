import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Switch, Alert, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, CURRENCIES, PAYMENT_METHODS } from '../theme';
import {
  getExpenseById, getExpenseShares, getTravelers, getCategories,
  insertExpense, updateExpense, getTripById, getPairs,
} from '../database/db';
import { fetchExchangeRate, formatDate, todayStr } from '../utils/currency';
import { loadPrefs, savePrefs } from '../utils/prefs';
import ModalPicker from '../components/ModalPicker';
import Header from '../components/Header';

export default function AddExpenseScreen({ navigation, route }) {
  const { tripId, expenseId, copyFromId } = route.params;

  const [travelers,     setTravelers]     = useState([]);
  const [categories,    setCategories]    = useState([]);
  const [pairs,         setPairs]         = useState([]);
  const [tripCurrency,  setTripCurrency]  = useState('EUR');

  const [paidBy,        setPaidBy]        = useState(null);
  const [categoryId,    setCategoryId]    = useState(null);
  const [amount,        setAmount]        = useState('');
  const [currency,      setCurrency]      = useState('EUR');
  const [amountPLN,     setAmountPLN]     = useState('');
  const [rate,          setRate]          = useState(null);
  const [manualRate,    setManualRate]    = useState('');
  const [useManual,     setUseManual]     = useState(false);
  const [date,          setDate]          = useState(todayStr());
  const [method,        setMethod]        = useState('Karta');
  const [isShared,      setIsShared]      = useState(true);
  const [includeInSplit,setIncludeInSplit]= useState(true);

  // Participant selection: individual traveler IDs and pair IDs
  const [selTravelers,  setSelTravelers]  = useState(new Set());
  const [selPairs,      setSelPairs]      = useState(new Set());

  // Custom split: 'none' | 'pairs' | 'persons'
  const [splitMode,     setSplitMode]     = useState('none');
  // Amounts keyed by 'p_pairId' or 't_travelerId'
  const [customAmounts, setCustomAmounts] = useState({});

  const [comment,       setComment]       = useState('');
  const [showDatePicker,setShowDatePicker]= useState(false);
  const [showCurrency,  setShowCurrency]  = useState(false);
  const [showComment,   setShowComment]   = useState(false);
  const [loadingRate,   setLoadingRate]   = useState(false);
  const [saving,        setSaving]        = useState(false);

  const fetchTimer = useRef(null);

  useEffect(() => {
    const init = async () => {
      const [tvl, cats, trip, prs] = await Promise.all([
        getTravelers(tripId), getCategories(tripId),
        getTripById(tripId), getPairs(tripId),
      ]);
      setTravelers(tvl); setCategories(cats); setPairs(prs);
      const defCur = trip?.default_currency || 'EUR';
      setTripCurrency(defCur);
      if (expenseId) {
        await loadExpense(tvl);
      } else if (copyFromId) {
        await loadExpenseCopy(tvl, copyFromId);
      } else {
        const prefs = await loadPrefs(tripId);
        if (prefs) {
          if (prefs.paidBy && tvl.find(t => t.id === prefs.paidBy)) setPaidBy(prefs.paidBy);
          else if (tvl.length) setPaidBy(tvl[0].id);
          if (prefs.currency) setCurrency(prefs.currency);
          if (prefs.method)   setMethod(prefs.method);
          if (prefs.categoryId) setCategoryId(prefs.categoryId);
        } else {
          if (tvl.length) setPaidBy(tvl[0].id);
          setCurrency(defCur);
        }
      }
    };
    init();
  }, []);

  const loadExpenseCopy = async (tvl, sourceId) => {
    const exp    = await getExpenseById(sourceId);
    const shares = await getExpenseShares(sourceId);
    if (!exp) return;
    setPaidBy(exp.paid_by); setCategoryId(exp.category_id);
    setAmount(String(exp.amount)); setCurrency(exp.currency);
    setAmountPLN(String(exp.amount_pln.toFixed(2)));
    setRate(exp.exchange_rate); setManualRate(String(exp.exchange_rate));
    setDate(todayStr()); setMethod(exp.method);
    setIsShared(exp.is_shared===1); setIncludeInSplit(exp.include_in_split!==0);
    setComment(exp.comment||'');
    setSelTravelers(new Set(shares.map(s=>s.traveler_id)));
    if (exp.comment) setShowComment(true);
  };

  const loadExpense = async (tvl) => {
    const exp    = await getExpenseById(expenseId);
    const shares = await getExpenseShares(expenseId);
    if (!exp) return;
    setPaidBy(exp.paid_by); setCategoryId(exp.category_id);
    setAmount(String(exp.amount)); setCurrency(exp.currency);
    setAmountPLN(String(exp.amount_pln.toFixed(2)));
    setRate(exp.exchange_rate); setManualRate(String(exp.exchange_rate));
    setDate(exp.date); setMethod(exp.method);
    setIsShared(exp.is_shared===1); setIncludeInSplit(exp.include_in_split!==0);
    setComment(exp.comment||'');
    const ids = new Set(shares.map(s=>s.traveler_id));
    setSelTravelers(ids);
    if (exp.comment) setShowComment(true);
  };

  useEffect(() => {
    if (useManual) return;
    if (currency==='PLN') { setRate(1); setManualRate('1'); recalcPLN(amount,1); return; }
    clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(()=>doFetchRate(), 600);
  }, [currency, date, useManual]);

  const doFetchRate = async () => {
    if (currency==='PLN') { setRate(1); recalcPLN(amount,1); return; }
    setLoadingRate(true);
    const r = await fetchExchangeRate(currency, date);
    setLoadingRate(false);
    if (r) { setRate(r); setManualRate(r.toFixed(4)); recalcPLN(amount,r); }
    else   { Alert.alert('Kurs niedostępny','Wpisz ręcznie.'); setUseManual(true); setShowCurrency(true); }
  };

  const recalcPLN = (amt, r) => {
    const n=parseFloat(amt), rn=parseFloat(r);
    if (!isNaN(n)&&!isNaN(rn)&&rn>0) setAmountPLN((n*rn).toFixed(2));
  };
  const onAmountChange = (v) => { setAmount(v); recalcPLN(v, useManual?parseFloat(manualRate):(rate||1)); };
  const onManualRateChange = (v) => { setManualRate(v); recalcPLN(amount,v); };
  const onAmountPLNChange = (v) => {
    setAmountPLN(v);
    const n=parseFloat(amount),p=parseFloat(v);
    if (n>0&&p>0) { const r=p/n; setRate(r); setManualRate(r.toFixed(4)); }
  };

  const toggleTraveler = (id) => {
    setSelTravelers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const togglePair = (pair) => {
    setSelPairs(prev => {
      const next = new Set(prev);
      if (next.has(pair.id)) {
        next.delete(pair.id);
        // Also deselect both travelers if they were selected via this pair
        setSelTravelers(prev2 => {
          const t = new Set(prev2);
          t.delete(pair.traveler1_id); t.delete(pair.traveler2_id);
          return t;
        });
      } else {
        next.add(pair.id);
        // Select both travelers
        setSelTravelers(prev2 => {
          const t = new Set(prev2);
          t.add(pair.traveler1_id); t.add(pair.traveler2_id);
          return t;
        });
      }
      return next;
    });
  };

  // Build shares array for saving
  const buildShares = () => {
    const plnTotal = parseFloat(amountPLN) || 0;
    const shares = [];

    if (splitMode === 'none') {
      // Equal split — pairs count as 1 unit, individuals as 1 unit
      const units = selTravelers.size - (selPairs.size * 2) + selPairs.size;
      // = individuals not in pairs + pairs
      const pairMemberIds = new Set();
      pairs.filter(p=>selPairs.has(p.id)).forEach(p=>{pairMemberIds.add(p.traveler1_id);pairMemberIds.add(p.traveler2_id);});
      const individualIds = [...selTravelers].filter(id=>!pairMemberIds.has(id));
      const totalUnits = individualIds.length + selPairs.size;
      if (totalUnits===0) return shares;
      const perUnit = plnTotal / totalUnits;
      individualIds.forEach(id => shares.push({ traveler_id:id, custom_amount:null }));
      pairs.filter(p=>selPairs.has(p.id)).forEach(p => {
        shares.push({ traveler_id:p.traveler1_id, custom_amount:perUnit/2 });
        shares.push({ traveler_id:p.traveler2_id, custom_amount:perUnit/2 });
      });
    } else if (splitMode === 'pairs') {
      // Custom amount per pair
      const pairMemberIds = new Set();
      pairs.filter(p=>selPairs.has(p.id)).forEach(p=>{
        pairMemberIds.add(p.traveler1_id); pairMemberIds.add(p.traveler2_id);
        const pairAmt = parseFloat(customAmounts[`p_${p.id}`])||0;
        shares.push({ traveler_id:p.traveler1_id, custom_amount:pairAmt/2 });
        shares.push({ traveler_id:p.traveler2_id, custom_amount:pairAmt/2 });
      });
      // Remaining individual travelers (not in any selected pair)
      [...selTravelers].filter(id=>!pairMemberIds.has(id)).forEach(id => {
        const amt = parseFloat(customAmounts[`t_${id}`])||0;
        shares.push({ traveler_id:id, custom_amount:amt });
      });
    } else {
      // Custom amount per person
      [...selTravelers].forEach(id => {
        const amt = parseFloat(customAmounts[`t_${id}`])||0;
        shares.push({ traveler_id:id, custom_amount:amt });
      });
    }
    return shares;
  };

  const handleSave = async () => {
    if (!paidBy)                               { Alert.alert('Błąd','Wybierz kto zapłacił'); return; }
    const amtNum=parseFloat(amount);
    if (!amount||isNaN(amtNum)||amtNum<=0)     { Alert.alert('Błąd','Wpisz kwotę'); return; }
    const plnNum=parseFloat(amountPLN);
    if (isNaN(plnNum)||plnNum<=0)              { Alert.alert('Błąd','Kwota PLN nieprawidłowa'); return; }
    if (!isShared&&selTravelers.size===0)      { Alert.alert('Błąd','Wybierz przynajmniej jedną osobę lub parę'); return; }

    setSaving(true);
    const effectiveRate = useManual?parseFloat(manualRate):(rate||1);
    const payload = {
      trip_id:tripId, paid_by:paidBy, category_id:categoryId,
      amount:amtNum, currency, amount_pln:plnNum, exchange_rate:effectiveRate,
      date, method, is_shared:isShared, include_in_split:includeInSplit, comment:comment.trim(),
    };
    const shares = isShared ? [] : buildShares();
    if (expenseId) await updateExpense({...payload,id:expenseId}, shares);
    else           await insertExpense(payload, shares);
    setSaving(false);
    if (!expenseId) {
      await savePrefs(tripId, { paidBy, currency, method, categoryId });
    }
    route.params?.onBack && route.params.onBack();
    navigation.goBack();
  };

  const travelerOptions = travelers.map(t=>({label:t.name,value:t.id}));
  const currencyOptions = CURRENCIES.map(c=>({label:c,value:c}));

  // For custom split totals
  const pairMemberIdsInSel = new Set();
  pairs.filter(p=>selPairs.has(p.id)).forEach(p=>{pairMemberIdsInSel.add(p.traveler1_id);pairMemberIdsInSel.add(p.traveler2_id);});
  const soloTravelerIds = [...selTravelers].filter(id=>!pairMemberIdsInSel.has(id));

  const customTotal = splitMode==='pairs'
    ? [...selPairs].reduce((s,pid)=>s+(parseFloat(customAmounts[`p_${pid}`])||0),0)
      + soloTravelerIds.reduce((s,id)=>s+(parseFloat(customAmounts[`t_${id}`])||0),0)
    : [...selTravelers].reduce((s,id)=>s+(parseFloat(customAmounts[`t_${id}`])||0),0);

  const plnTotal = parseFloat(amountPLN)||0;

  return (
    <KeyboardAvoidingView style={{flex:1,backgroundColor:COLORS.background}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <Header title={expenseId?'Edytuj Wydatek':copyFromId?'Kopiuj Wydatek':'Nowy Wydatek'} showBack onBack={()=>navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Kto zapłacił ── */}
        <Text style={styles.label}>Kto zapłacił</Text>
        <ModalPicker value={paidBy} options={travelerOptions} onChange={setPaidBy} placeholder="Wybierz osobę..." title="Kto zapłacił" />

        {/* ── Kwota ── */}
        <Text style={styles.label}>Kwota</Text>
        <View style={styles.row}>
          <TextInput style={[styles.input,{flex:1,marginRight:8}]} placeholder="0.00"
            placeholderTextColor={COLORS.textSecondary} value={amount} onChangeText={onAmountChange} keyboardType="decimal-pad" />
          <TouchableOpacity style={[styles.curChip,currency==='PLN'&&styles.curChipActive]} onPress={()=>{setCurrency('PLN');setUseManual(false);}}>
            <Text style={[styles.curChipText,currency==='PLN'&&styles.curChipTextActive]}>PLN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.curChip,currency===tripCurrency&&styles.curChipActive,{marginLeft:6}]} onPress={()=>{setCurrency(tripCurrency);setUseManual(false);}}>
            <Text style={[styles.curChipText,currency===tripCurrency&&styles.curChipTextActive]}>{tripCurrency}</Text>
          </TouchableOpacity>
        </View>

        {currency!=='PLN' && (
          <View style={styles.plnRow}>
            {loadingRate?<ActivityIndicator color={COLORS.primary} size="small"/>:<Text style={styles.plnHint}>= </Text>}
            <TextInput style={styles.plnInput} value={amountPLN} onChangeText={onAmountPLNChange} keyboardType="decimal-pad" placeholder="0.00 PLN" placeholderTextColor={COLORS.textSecondary} />
            <Text style={styles.plnHint}> PLN</Text>
          </View>
        )}

        <TouchableOpacity style={styles.expandBtn} onPress={()=>setShowCurrency(v=>!v)}>
          <Text style={styles.expandBtnText}>{showCurrency?'▲ Ukryj kurs / walutę':'▼ Inna waluta / kurs ręczny'}</Text>
        </TouchableOpacity>
        {showCurrency && (
          <View style={styles.expandBox}>
            <Text style={styles.labelSm}>Waluta</Text>
            <ModalPicker value={currency} options={currencyOptions} onChange={c=>{setCurrency(c);setUseManual(false);}} title="Waluta" />
            <View style={styles.rateRow}>
              <View style={{flex:1,marginRight:8}}>
                <Text style={styles.labelSm}>Kurs NBP</Text>
                {useManual
                  ?<TextInput style={styles.input} value={manualRate} onChangeText={onManualRateChange} keyboardType="decimal-pad" placeholder="np. 4.28" placeholderTextColor={COLORS.textSecondary}/>
                  :<View style={styles.rateDisplay}>{loadingRate?<ActivityIndicator color={COLORS.primary} size="small"/>:<Text style={styles.rateValue}>{rate?rate.toFixed(4):'—'}</Text>}</View>
                }
              </View>
              <View style={{flex:1}}>
                <Text style={styles.labelSm}>Kwota PLN</Text>
                <TextInput style={styles.input} value={amountPLN} onChangeText={onAmountPLNChange} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={COLORS.textSecondary}/>
              </View>
            </View>
            <View style={styles.manualRow}>
              <Text style={styles.labelSm}>Kurs ręczny</Text>
              <Switch value={useManual} onValueChange={v=>{setUseManual(v);if(!v)doFetchRate();}} trackColor={{false:COLORS.border,true:COLORS.primary}} thumbColor={COLORS.white}/>
            </View>
          </View>
        )}

        {/* ── Kategoria ── */}
        <Text style={styles.label}>Kategoria</Text>
        <View style={styles.tilesWrap}>
          <TouchableOpacity style={[styles.catTile,categoryId===null&&styles.catTileActive]} onPress={()=>setCategoryId(null)}>
            <Text style={[styles.catTileText,categoryId===null&&styles.catTileTextActive]}>Brak</Text>
          </TouchableOpacity>
          {categories.map(c=>(
            <TouchableOpacity key={c.id} style={[styles.catTile,categoryId===c.id&&styles.catTileActive,categoryId===c.id&&{borderColor:c.color}]} onPress={()=>setCategoryId(c.id)}>
              <View style={[styles.catDot,{backgroundColor:c.color}]}/>
              <Text style={[styles.catTileText,categoryId===c.id&&{color:c.color}]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Data ── */}
        <Text style={styles.label}>Data</Text>
        <TouchableOpacity style={styles.input} onPress={()=>setShowDatePicker(true)}>
          <Text style={{color:COLORS.text,fontSize:15}}>{formatDate(date)}</Text>
        </TouchableOpacity>
        {showDatePicker && <DateTimePicker value={new Date(date)} mode="date" display="default" onChange={(_,d)=>{setShowDatePicker(false);if(d)setDate(d.toISOString().split('T')[0]);}}/>}

        {/* ── Metoda ── */}
        <Text style={styles.label}>Metoda płatności</Text>
        <View style={styles.tilesWrap}>
          {PAYMENT_METHODS.map(m=>(
            <TouchableOpacity key={m} style={[styles.methodTile,method===m&&styles.methodTileActive]} onPress={()=>setMethod(m)}>
              <Text style={[styles.methodTileText,method===m&&styles.methodTileTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Komentarz ── */}
        <TouchableOpacity style={styles.expandBtn} onPress={()=>setShowComment(v=>!v)}>
          <Text style={styles.expandBtnText}>{showComment?'▲ Ukryj komentarz':'▼ Dodaj komentarz'}</Text>
        </TouchableOpacity>
        {showComment && (
          <TextInput style={[styles.input,styles.inputMulti]} placeholder="Opis wydatku..." placeholderTextColor={COLORS.textSecondary} value={comment} onChangeText={setComment} multiline numberOfLines={2}/>
        )}

        {/* ── Podział ── */}
        <Text style={styles.label}>Podział wydatku</Text>
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Wspólny (cała grupa)</Text>
            <Text style={styles.switchHint}>{isShared?'Równo na wszystkich':'Wybrane osoby / pary'}</Text>
          </View>
          <Switch value={isShared} onValueChange={v=>{setIsShared(v);if(v){setSelTravelers(new Set());setSelPairs(new Set());setSplitMode('none');}}} trackColor={{false:COLORS.border,true:COLORS.primary}} thumbColor={COLORS.white}/>
        </View>

        {!isShared && (
          <View style={styles.sharesBox}>
            {/* Individual travelers */}
            <Text style={styles.labelSm}>Osoby:</Text>
            <View style={[styles.tilesWrap,{marginBottom:10}]}>
              {travelers.map(t=>{
                const sel=selTravelers.has(t.id);
                const inPair=pairs.some(p=>selPairs.has(p.id)&&(p.traveler1_id===t.id||p.traveler2_id===t.id));
                return (
                  <TouchableOpacity key={t.id} style={[styles.methodTile,sel&&styles.methodTileActive,inPair&&styles.methodTilePair]} onPress={()=>toggleTraveler(t.id)}>
                    <Text style={[styles.methodTileText,sel&&styles.methodTileTextActive]}>{sel?'✓ ':''}{t.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Pairs */}
            {pairs.length>0 && (
              <>
                <Text style={styles.labelSm}>Pary:</Text>
                <View style={[styles.tilesWrap,{marginBottom:10}]}>
                  {pairs.map(p=>{
                    const sel=selPairs.has(p.id);
                    return (
                      <TouchableOpacity key={p.id} style={[styles.pairTile,sel&&styles.pairTileActive]} onPress={()=>togglePair(p)}>
                        <Text style={styles.pairTileIcon}>👫</Text>
                        <Text style={[styles.pairTileText,sel&&styles.pairTileTextActive]}>{p.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Split mode selector */}
            {(selTravelers.size>0||selPairs.size>0) && (
              <>
                <TouchableOpacity style={styles.expandBtn} onPress={()=>setSplitMode(v=>v==='none'?(pairs.length>0&&selPairs.size>0?'pairs':'persons'):'none')}>
                  <Text style={styles.expandBtnText}>
                    {splitMode==='none'?'▼ Podziel konkretnymi kwotami (restauracja)':'▲ Ukryj podział kwotami'}
                  </Text>
                </TouchableOpacity>

                {splitMode!=='none' && (
                  <View style={{marginTop:8}}>
                    {/* Toggle between pair-mode and person-mode */}
                    {pairs.length>0 && selPairs.size>0 && (
                      <View style={styles.splitModeRow}>
                        <TouchableOpacity style={[styles.splitModeBtn,splitMode==='pairs'&&styles.splitModeBtnActive]} onPress={()=>setSplitMode('pairs')}>
                          <Text style={[styles.splitModeBtnText,splitMode==='pairs'&&styles.splitModeBtnTextActive]}>👫 Na pary</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.splitModeBtn,splitMode==='persons'&&styles.splitModeBtnActive]} onPress={()=>setSplitMode('persons')}>
                          <Text style={[styles.splitModeBtnText,splitMode==='persons'&&styles.splitModeBtnTextActive]}>👤 Na osoby</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Pair amounts */}
                    {splitMode==='pairs' && (
                      <>
                        {pairs.filter(p=>selPairs.has(p.id)).map(p=>{
                          const pAmt = parseFloat(customAmounts[`p_${p.id}`])||0;
                          return (
                            <View key={p.id} style={styles.customRow}>
                              <View style={{flex:1}}>
                                <Text style={styles.customName}>👫 {p.name}</Text>
                                <Text style={styles.customSub}>{p.name1} + {p.name2}  ·  po {(pAmt/2).toFixed(2)} PLN / os.</Text>
                              </View>
                              <TextInput style={styles.customInput} placeholder="0.00" placeholderTextColor={COLORS.textSecondary}
                                value={customAmounts[`p_${p.id}`]||''} onChangeText={v=>setCustomAmounts(prev=>({...prev,[`p_${p.id}`]:v}))} keyboardType="decimal-pad"/>
                              <Text style={styles.customCur}>PLN</Text>
                            </View>
                          );
                        })}
                        {soloTravelerIds.map(id=>{
                          const t=travelers.find(x=>x.id===id);
                          return (
                            <View key={id} style={styles.customRow}>
                              <Text style={[styles.customName,{flex:1}]}>👤 {t?.name}</Text>
                              <TextInput style={styles.customInput} placeholder="0.00" placeholderTextColor={COLORS.textSecondary}
                                value={customAmounts[`t_${id}`]||''} onChangeText={v=>setCustomAmounts(prev=>({...prev,[`t_${id}`]:v}))} keyboardType="decimal-pad"/>
                              <Text style={styles.customCur}>PLN</Text>
                            </View>
                          );
                        })}
                      </>
                    )}

                    {/* Per-person amounts */}
                    {splitMode==='persons' && [...selTravelers].map(id=>{
                      const t=travelers.find(x=>x.id===id);
                      return (
                        <View key={id} style={styles.customRow}>
                          <Text style={[styles.customName,{flex:1}]}>👤 {t?.name}</Text>
                          <TextInput style={styles.customInput} placeholder="0.00" placeholderTextColor={COLORS.textSecondary}
                            value={customAmounts[`t_${id}`]||''} onChangeText={v=>setCustomAmounts(prev=>({...prev,[`t_${id}`]:v}))} keyboardType="decimal-pad"/>
                          <Text style={styles.customCur}>PLN</Text>
                        </View>
                      );
                    })}

                    {/* Total check */}
                    <View style={styles.customTotalRow}>
                      <Text style={styles.customTotalLabel}>Suma:</Text>
                      <Text style={[styles.customTotalValue,{color:Math.abs(customTotal-plnTotal)<0.01?COLORS.success:COLORS.warning}]}>
                        {customTotal.toFixed(2)} / {plnTotal.toFixed(2)} PLN
                        {Math.abs(customTotal-plnTotal)<0.01?'  ✓':`  (różnica: ${(customTotal-plnTotal).toFixed(2)})`}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        <View style={[styles.switchRow,{marginTop:8}]}>
          <View>
            <Text style={styles.switchLabel}>Wlicz do rozliczenia</Text>
            <Text style={styles.switchHint}>{includeInSplit?'Wliczany do podziału':'Pominięty'}</Text>
          </View>
          <Switch value={includeInSplit} onValueChange={setIncludeInSplit} trackColor={{false:COLORS.border,true:COLORS.secondary}} thumbColor={COLORS.white}/>
        </View>

        <TouchableOpacity style={[styles.saveBtn,saving&&styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          {saving?<ActivityIndicator color={COLORS.white}/>:<Text style={styles.saveBtnText}>{expenseId?'Zapisz zmiany':'Dodaj wydatek'}</Text>}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding:16, paddingBottom:48 },
  label:   { fontSize:12, fontWeight:'700', color:COLORS.textSecondary, textTransform:'uppercase', letterSpacing:0.7, marginTop:18, marginBottom:8 },
  labelSm: { fontSize:11, color:COLORS.textSecondary, fontWeight:'600', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 },
  input:   { backgroundColor:COLORS.surfaceVariant, borderRadius:10, borderWidth:1, borderColor:COLORS.border, color:COLORS.text, fontSize:15, paddingHorizontal:14, paddingVertical:13 },
  inputMulti: { textAlignVertical:'top', height:72, marginTop:6 },
  row:     { flexDirection:'row', alignItems:'center' },
  curChip:          { paddingHorizontal:14, paddingVertical:13, borderRadius:10, backgroundColor:COLORS.surfaceVariant, borderWidth:1, borderColor:COLORS.border },
  curChipActive:    { backgroundColor:COLORS.primary, borderColor:COLORS.primary },
  curChipText:      { color:COLORS.textSecondary, fontSize:15, fontWeight:'600' },
  curChipTextActive:{ color:COLORS.white },
  plnRow:  { flexDirection:'row', alignItems:'center', marginTop:8, backgroundColor:COLORS.surfaceVariant, borderRadius:10, borderWidth:1, borderColor:COLORS.border, paddingHorizontal:14, paddingVertical:10 },
  plnInput:{ flex:1, color:COLORS.text, fontSize:15 },
  plnHint: { color:COLORS.textSecondary, fontSize:14 },
  expandBtn:    { marginTop:10, paddingVertical:8, alignItems:'center' },
  expandBtnText:{ color:COLORS.primary, fontSize:13, fontWeight:'600' },
  expandBox:    { backgroundColor:COLORS.surfaceVariant, borderRadius:12, borderWidth:1, borderColor:COLORS.border, padding:14, marginBottom:4 },
  rateRow:      { flexDirection:'row', marginTop:10 },
  rateDisplay:  { backgroundColor:COLORS.card, borderRadius:8, borderWidth:1, borderColor:COLORS.border, paddingHorizontal:12, paddingVertical:12, justifyContent:'center' },
  rateValue:    { color:COLORS.text, fontSize:15 },
  manualRow:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:10 },
  tilesWrap:    { flexDirection:'row', flexWrap:'wrap', gap:8 },
  catTile:      { flexDirection:'row', alignItems:'center', paddingHorizontal:12, paddingVertical:8, borderRadius:20, backgroundColor:COLORS.surfaceVariant, borderWidth:1, borderColor:COLORS.border },
  catTileActive:    { backgroundColor:COLORS.surfaceVariant },
  catTileText:      { color:COLORS.textSecondary, fontSize:13, fontWeight:'500' },
  catTileTextActive:{ fontWeight:'700' },
  catDot:       { width:8, height:8, borderRadius:4, marginRight:6 },
  methodTile:          { paddingHorizontal:14, paddingVertical:8, borderRadius:20, backgroundColor:COLORS.surfaceVariant, borderWidth:1, borderColor:COLORS.border },
  methodTileActive:    { backgroundColor:COLORS.primary, borderColor:COLORS.primary },
  methodTilePair:      { borderColor:COLORS.secondary, borderStyle:'dashed' },
  methodTileText:      { color:COLORS.textSecondary, fontSize:13, fontWeight:'500' },
  methodTileTextActive:{ color:COLORS.white, fontWeight:'700' },
  pairTile:          { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:8, borderRadius:20, backgroundColor:COLORS.surfaceVariant, borderWidth:1, borderColor:COLORS.border },
  pairTileActive:    { backgroundColor:'#2a1f5a', borderColor:COLORS.primary },
  pairTileIcon:      { fontSize:14, marginRight:6 },
  pairTileText:      { color:COLORS.textSecondary, fontSize:13, fontWeight:'500' },
  pairTileTextActive:{ color:COLORS.primary, fontWeight:'700' },
  switchRow:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:COLORS.surfaceVariant, borderRadius:10, borderWidth:1, borderColor:COLORS.border, padding:14, marginTop:6 },
  switchLabel: { color:COLORS.text, fontSize:15, fontWeight:'500' },
  switchHint:  { color:COLORS.textSecondary, fontSize:12, marginTop:2 },
  sharesBox:   { backgroundColor:COLORS.surfaceVariant, borderRadius:10, borderWidth:1, borderColor:COLORS.border, padding:14, marginTop:8 },
  splitModeRow:{ flexDirection:'row', gap:8, marginBottom:12 },
  splitModeBtn:      { flex:1, paddingVertical:8, borderRadius:20, backgroundColor:COLORS.card, borderWidth:1, borderColor:COLORS.border, alignItems:'center' },
  splitModeBtnActive:{ backgroundColor:COLORS.primary, borderColor:COLORS.primary },
  splitModeBtnText:      { color:COLORS.textSecondary, fontSize:13, fontWeight:'600' },
  splitModeBtnTextActive:{ color:COLORS.white },
  customRow:     { flexDirection:'row', alignItems:'center', marginBottom:10 },
  customName:    { color:COLORS.text, fontSize:14, fontWeight:'600' },
  customSub:     { color:COLORS.textSecondary, fontSize:11, marginTop:2 },
  customInput:   { width:90, backgroundColor:COLORS.card, borderRadius:8, borderWidth:1, borderColor:COLORS.border, color:COLORS.text, fontSize:14, paddingHorizontal:10, paddingVertical:8, textAlign:'right' },
  customCur:     { color:COLORS.textSecondary, fontSize:13, marginLeft:6, width:30 },
  customTotalRow:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:8, paddingTop:8, borderTopWidth:1, borderTopColor:COLORS.border },
  customTotalLabel:{ color:COLORS.textSecondary, fontSize:13 },
  customTotalValue:{ fontSize:13, fontWeight:'700' },
  saveBtn:         { backgroundColor:COLORS.primary, borderRadius:12, padding:16, alignItems:'center', marginTop:28 },
  saveBtnDisabled: { opacity:0.5 },
  saveBtnText:     { color:COLORS.white, fontWeight:'700', fontSize:17 },
});
