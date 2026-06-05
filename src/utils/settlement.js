export const calculateSettlement = (travelers, expenses, payments = []) => {
  const paid      = {};
  const shouldPay = {};
  travelers.forEach(t => { paid[t.id] = 0; shouldPay[t.id] = 0; });

  // Process expenses
  expenses.forEach(expense => {
    const amount = parseFloat(expense.amount_pln);
    if (paid[expense.paid_by] !== undefined) paid[expense.paid_by] += amount;

    let participantIds;
    if (expense.is_shared) {
      participantIds = travelers.map(t => t.id);
    } else {
      participantIds = (expense.shares || []).map(s => s.traveler_id);
    }
    if (!participantIds.length) return;

    // Check if custom amounts are set
    const hasCustom = !expense.is_shared && expense.shares?.some(s => s.custom_amount != null);

    if (hasCustom) {
      // Use custom amounts per person
      expense.shares.forEach(s => {
        const amt = s.custom_amount != null ? parseFloat(s.custom_amount) : 0;
        if (shouldPay[s.traveler_id] !== undefined) shouldPay[s.traveler_id] += amt;
      });
    } else {
      // Equal split
      const share = amount / participantIds.length;
      participantIds.forEach(id => { if (shouldPay[id] !== undefined) shouldPay[id] += share; });
    }
  });

  // Build net balances
  const nets = travelers.map(t => ({
    id: t.id, name: t.name,
    paid: paid[t.id], shouldPay: shouldPay[t.id],
    net: paid[t.id] - shouldPay[t.id],
  }));

  // Apply registered payments
  // A payment from A to B: A's debt is reduced (net increases), B's credit is reduced (net decreases)
  payments.forEach(p => {
    const amount = parseFloat(p.amount);
    const from   = nets.find(n => n.id === p.from_traveler);
    const to     = nets.find(n => n.id === p.to_traveler);
    if (from) from.net += amount;
    if (to)   to.net   -= amount;
  });

  // Minimise transactions with greedy algorithm
  const creditors = nets.filter(n => n.net >  0.005).map(n => ({ ...n })).sort((a, b) => b.net - a.net);
  const debtors   = nets.filter(n => n.net < -0.005).map(n => ({ ...n })).sort((a, b) => a.net - b.net);

  const transactions = [];
  while (creditors.length && debtors.length) {
    const creditor = creditors[0];
    const debtor   = debtors[0];
    const amount   = Math.min(creditor.net, -debtor.net);
    transactions.push({
      from: debtor.name, fromId: debtor.id,
      to:   creditor.name, toId: creditor.id,
      amount: Math.round(amount * 100) / 100,
    });
    creditor.net -= amount;
    debtor.net   += amount;
    if (creditor.net < 0.005) creditors.shift();
    if (-debtor.net  < 0.005) debtors.shift();
  }

  return { balances: nets, transactions };
};
