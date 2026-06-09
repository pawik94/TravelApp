import { TABLE_B_CURRENCIES } from '../theme';
const rateCache = {};
export const fetchExchangeRate = async (currency, date) => {
  if (currency === 'PLN') return 1;
  const cacheKey = `${currency}-${date}`;
  if (rateCache[cacheKey]) return rateCache[cacheKey];
  const table = TABLE_B_CURRENCIES.includes(currency) ? 'b' : 'a';
  for (let offset = 0; offset <= 7; offset++) {
    const d = new Date(date); d.setDate(d.getDate() - offset);
    const dateStr = d.toISOString().split('T')[0];
    try {
      const res = await fetch(`https://api.nbp.pl/api/exchangerates/rates/${table}/${currency.toLowerCase()}/${dateStr}/?format=json`);
      if (!res.ok) continue;
      const data = await res.json();
      const rate = data.rates[0].mid;
      rateCache[cacheKey] = rate;
      return rate;
    } catch (_) {}
  }
  return null;
};
export const todayStr = () => new Date().toISOString().split('T')[0];
export const formatPLN = (amount) => {
  const n = Math.ceil(parseFloat(amount || 0));
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '\u00a0z\u0142';
};
export const formatAmount = (amount, currency) => `${parseFloat(amount || 0).toFixed(2)} ${currency}`;
export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
};
