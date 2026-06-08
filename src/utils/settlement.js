export const calculateSettlement = (travelers, expenses, payments = []) => {
  const paid      = {};
  const shouldPay = {};
  travelers.forEach(t => { paid[t.id] = 0; shouldPay[t.id] = 0; });

  expenses.forEach(expense => {
    const amount = parseFloat(expense.amount_pln);
    if (paid[expense.paid_by] !== undefined) paid[expense.paid_by] += amount;

    if (expense.is_shared) {
      // Equal split between all travelers
      const share = amount / travelers.length;
      travelers.forEach(t => { if (shouldPay[t.id] !== undefined) shouldPay[t.id] += share; });
    } else {
      const shares = expense.shares || [];
      const hasCustom = shares.some(s => s.custom_amount != null);
      if (hasCustom) {
        // Use stored custom amounts (already calculated per-person including pair splits)
        shares.forEach(s => {
          const amt = s.custom_amount != null ? parseFloat(s.custom_amount) : 0;
          if (shouldPay[s.traveler_id] !== undefined) shouldPay[s.traveler_id] += amt;
        });
      } else {
        // Equal split among selected participants
        const ids = shares.map(s => s.traveler_id).filter(id => shouldPay[id] !== undefined);
        if (ids.length) {
          const share = amount / ids.length;
          ids.forEach(id => { shouldPay[id] += share; });
        }
      }
    }
  });

  const nets = travelers.map(t => ({
    id: t.id, name: t.name,
    paid: paid[t.id], shouldPay: shouldPay[t.id],
    net: paid[t.id] - shouldPay[t.id],
  }));

  // Apply registered payments
  payments.forEach(p => {
    const amount = parseFloat(p.amount);
    const from = nets.find(n => n.id === p.from_traveler);
    const to   = nets.find(n => n.id === p.to_traveler);

    if (p.on_behalf_pair && p.traveler1_id && p.traveler2_id) {
      // Payment on behalf of pair — split effect between both pair members
      const member1 = nets.find(n => n.id === p.traveler1_id);
      const member2 = nets.find(n => n.id === p.traveler2_id);
      if (member1) member1.net += amount / 2;
      if (member2) member2.net += amount / 2;
    } else {
      if (from) from.net += amount;
    }
    if (to) to.net -= amount;
  });

  // Minimise transactions
  const creditors = nets.filter(n => n.net >  0.005).map(n => ({ ...n })).sort((a,b) => b.net-a.net);
  const debtors   = nets.filter(n => n.net < -0.005).map(n => ({ ...n })).sort((a,b) => a.net-b.net);
  const transactions = [];

  while (creditors.length && debtors.length) {
    const creditor = creditors[0];
    const debtor   = debtors[0];
    const amount   = Math.min(creditor.net, -debtor.net);
    transactions.push({
      from: debtor.name, fromId: debtor.id,
      to: creditor.name, toId: creditor.id,
      amount: Math.round(amount * 100) / 100,
    });
    creditor.net -= amount;
    debtor.net   += amount;
    if (creditor.net < 0.005) creditors.shift();
    if (-debtor.net < 0.005) debtors.shift();
  }

  return { balances: nets, transactions };
};
