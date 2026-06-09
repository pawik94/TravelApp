import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { COLORS } from '../theme';

const DAYS_PL  = ['Pn','Wt','Śr','Cz','Pt','So','Nd'];
const MONTHS_PL = [
  'Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
  'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień',
];

function isoToMidnight(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toIso(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function addMonths(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return r;
}

function getDaysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

function getFirstWeekday(y, m) {
  // Monday = 0, ..., Sunday = 6
  return (new Date(y, m, 1).getDay() + 6) % 7;
}

function nightsLabel(start, end) {
  if (!start || !end) return '';
  const diff = Math.round((isoToMidnight(end) - isoToMidnight(start)) / 86400000);
  if (diff <= 0) return '';
  if (diff === 1) return '1 noc';
  if (diff < 5) return diff + ' noce';
  return diff + ' nocy';
}

function formatDatePL(iso) {
  if (!iso) return '';
  const d = isoToMidnight(iso);
  return d.getDate() + ' ' + MONTHS_PL[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear();
}

// ─────────────────────────────────────────────────────────────────────────────

export default function DateRangePicker({ visible, startDate, endDate, onConfirm, onClose }) {
  const todayIso = toIso(new Date());

  const [viewDate, setViewDate] = useState(() => {
    const base = startDate ? isoToMidnight(startDate) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [sel1, setSel1] = useState('');  // first tap (always start)
  const [sel2, setSel2] = useState('');  // second tap (always end)
  const [step, setStep]  = useState('start');

  useEffect(() => {
    if (visible) {
      setSel1(startDate || '');
      setSel2(endDate || '');
      setStep(startDate && !endDate ? 'end' : 'start');
      const base = startDate ? isoToMidnight(startDate) : new Date();
      setViewDate(new Date(base.getFullYear(), base.getMonth(), 1));
    }
  }, [visible]);

  const handleDay = (iso) => {
    if (iso < todayIso) return; // past day — ignore

    if (step === 'start' || iso <= sel1) {
      // Start fresh
      setSel1(iso);
      setSel2('');
      setStep('end');
    } else {
      // End selected — confirm immediately
      setSel2(iso);
      onConfirm(sel1, iso);
    }
  };

  const buildGrid = () => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    const total = getDaysInMonth(y, m);
    const offset = getFirstWeekday(y, m);
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= total; d++) {
      cells.push(toIso(new Date(y, m, d)));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  };

  const classifyDay = (iso) => {
    if (!iso) return {};
    const isStart   = iso === sel1;
    const isEnd     = iso === sel2;
    const inRange   = sel1 && sel2 && iso > sel1 && iso < sel2;
    const isPast    = iso < todayIso;
    const isToday   = iso === todayIso;
    // strip sides: for range-strip half-covers
    const stripLeft  = isEnd   && sel1 && sel2; // strip goes from left edge to center
    const stripRight = isStart && sel1 && sel2; // strip goes from center to right edge
    return { isStart, isEnd, inRange, isPast, isToday, stripLeft, stripRight };
  };

  const weeks = buildGrid();
  const label = nightsLabel(sel1, sel2);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent
      statusBarTranslucent
    >
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>

          {/* ── Header ── */}
          <View style={s.headerRow}>
            <TouchableOpacity onPress={onClose} style={s.iconBtn} hitSlop={8}>
              <Text style={s.iconTxt}>✕</Text>
            </TouchableOpacity>

            <View style={s.headerCenter}>
              {sel1 || sel2 ? (
                <>
                  <Text style={s.datesRow}>
                    {sel1 ? formatDatePL(sel1) : '—'}
                    {'  →  '}
                    {sel2 ? formatDatePL(sel2) : '?'}
                  </Text>
                  {label ? <Text style={s.nightsLabel}>{label}</Text> : null}
                </>
              ) : (
                <Text style={s.placeholder}>Wybierz termin podróży</Text>
              )}
            </View>

            <TouchableOpacity
              onPress={() => { setSel1(''); setSel2(''); setStep('start'); }}
              style={s.iconBtn} hitSlop={8}
            >
              <Text style={[s.iconTxt, { color: COLORS.primary, fontSize: 12 }]}>
                Wyczyść
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Month nav ── */}
          <View style={s.monthNav}>
            <TouchableOpacity onPress={() => setViewDate(d => addMonths(d, -1))} style={s.navBtn} hitSlop={8}>
              <Text style={s.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={s.monthName}>
              {MONTHS_PL[viewDate.getMonth()] + ' ' + viewDate.getFullYear()}
            </Text>
            <TouchableOpacity onPress={() => setViewDate(d => addMonths(d, 1))} style={s.navBtn} hitSlop={8}>
              <Text style={s.navArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* ── Day-of-week headers ── */}
          <View style={s.weekRow}>
            {DAYS_PL.map(d => (
              <View key={d} style={s.cell}>
                <Text style={s.dowLabel}>{d}</Text>
              </View>
            ))}
          </View>

          {/* ── Calendar grid ── */}
          {weeks.map((week, wi) => (
            <View key={wi} style={s.weekRow}>
              {week.map((iso, di) => {
                if (!iso) return <View key={di} style={s.cell} />;
                const { isStart, isEnd, inRange, isPast, isToday, stripLeft, stripRight } = classifyDay(iso);
                const dayNum = parseInt(iso.split('-')[2], 10);

                return (
                  <TouchableOpacity
                    key={di}
                    style={s.cell}
                    onPress={() => handleDay(iso)}
                    activeOpacity={isPast ? 1 : 0.65}
                    disabled={isPast}
                  >
                    {/* Range strip — full width for inRange, half for edges */}
                    {inRange && <View style={s.strip} />}
                    {stripRight && <View style={[s.strip, s.stripRight]} />}
                    {stripLeft  && <View style={[s.strip, s.stripLeft]}  />}

                    {/* Day circle */}
                    <View style={[
                      s.circle,
                      (isStart || isEnd) && s.circleSelected,
                      isToday && !isStart && !isEnd && s.circleToday,
                    ]}>
                      <Text style={[
                        s.dayTxt,
                        isPast    && s.dayPast,
                        inRange   && s.dayInRange,
                        isToday   && !isStart && !isEnd && s.dayToday,
                        (isStart || isEnd) && s.daySelected,
                      ]}>
                        {dayNum}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* ── Footer hint ── */}
          <View style={s.footer}>
            <Text style={s.footerTxt}>
              {step === 'start'
                ? 'Dotknij daty przyjazdu'
                : sel2
                  ? 'Gotowe — możesz zmienić daty'
                  : 'Dotknij daty wyjazdu'}
            </Text>
          </View>

        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const RANGE_BG = COLORS.primary + '28'; // ~15% opacity

const s = StyleSheet.create({
  overlay:     { flex:1, justifyContent:'flex-end' },
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.55)' },
  sheet:       { backgroundColor:COLORS.surface, borderTopLeftRadius:22, borderTopRightRadius:22, paddingBottom:28 },

  // Header
  headerRow:   { flexDirection:'row', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:COLORS.border },
  iconBtn:     { width:52, alignItems:'center' },
  iconTxt:     { color:COLORS.textSecondary, fontSize:16 },
  headerCenter:{ flex:1, alignItems:'center' },
  datesRow:    { color:COLORS.text, fontSize:15, fontWeight:'700' },
  nightsLabel: { color:COLORS.primary, fontSize:12, marginTop:3, fontWeight:'600' },
  placeholder: { color:COLORS.textSecondary, fontSize:14 },

  // Month nav
  monthNav:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:14 },
  navBtn:      { width:36, height:36, alignItems:'center', justifyContent:'center' },
  navArrow:    { color:COLORS.text, fontSize:26, lineHeight:30 },
  monthName:   { color:COLORS.text, fontSize:16, fontWeight:'700' },

  // Grid
  weekRow:     { flexDirection:'row', paddingHorizontal:6 },
  cell:        { flex:1, height:46, alignItems:'center', justifyContent:'center', position:'relative' },
  dowLabel:    { color:COLORS.textSecondary, fontSize:12, fontWeight:'600' },

  // Range strips
  strip:       { position:'absolute', left:0, right:0, top:'18%', bottom:'18%', backgroundColor:RANGE_BG, zIndex:0 },
  stripRight:  { left:'50%', right:0 },
  stripLeft:   { left:0, right:'50%' },

  // Day circles
  circle:         { width:38, height:38, borderRadius:19, alignItems:'center', justifyContent:'center', zIndex:1 },
  circleSelected: { backgroundColor:COLORS.primary },
  circleToday:    { borderWidth:1.5, borderColor:COLORS.primary },

  // Day text
  dayTxt:      { fontSize:14, color:COLORS.text },
  dayPast:     { color:COLORS.textSecondary, opacity:0.35 },
  dayInRange:  { color:COLORS.primary, fontWeight:'600' },
  dayToday:    { color:COLORS.primary, fontWeight:'700' },
  daySelected: { color:COLORS.white, fontWeight:'700' },

  // Footer
  footer:      { alignItems:'center', paddingTop:18, paddingBottom:4 },
  footerTxt:   { color:COLORS.textSecondary, fontSize:13 },
});
