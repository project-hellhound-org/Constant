import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Plus, X } from 'lucide-react';
import { db, FinanceAccount, FinanceTransaction } from '../db/schema';

import { CURRENCIES, money, useCurrency } from '../lib/currency';
export { CURRENCIES, money };

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Education', 'Shopping', 'Bills', 'Health', 'Salary', 'Other'];
type TxType = FinanceTransaction['type'];

/** Net effect of one transaction on account balances. */
function balanceEffects(t: { type: TxType; amount: number; accountId: string; toAccountId?: string }): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (id: string | undefined, v: number) => { if (id) out[id] = (out[id] || 0) + v; };
  if (t.type === 'expense') add(t.accountId, -t.amount);
  if (t.type === 'income' || t.type === 'refund') add(t.accountId, t.amount);
  if (t.type === 'transfer') { add(t.accountId, -t.amount); add(t.toAccountId, t.amount); }
  return out;
}

interface Props { accounts: FinanceAccount[]; transaction?: FinanceTransaction | null; onDone: () => void; onCancel?: () => void }

/** Single transaction form used by the docked sidebar and the edit dialog. */
export const TransactionForm: React.FC<Props> = ({ accounts, transaction, onDone, onCancel }) => {
  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setGlobalCurrency] = useCurrency();
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [error, setError] = useState('');
  const known = useMemo(() => [] as string[], []);

  useEffect(() => {
    const t = transaction;
    setType(t?.type ?? 'expense'); setAmount(t ? String(t.amount) : ''); setAccountId(t?.accountId ?? accounts[0]?.id ?? ''); setToAccountId(t?.toAccountId ?? '');
    setCategory(t?.category ?? ''); setDate(t?.date ?? format(new Date(), 'yyyy-MM-dd')); setTime(t?.time ?? format(new Date(), 'HH:mm'));
    setMerchant(t?.merchant ?? ''); setDescription(t?.description ?? ''); setNotes(t?.notes ?? ''); setTags(t?.tags ?? []); setError('');
  }, [transaction?.id, accounts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const addTag = () => { const v = tagDraft.trim().replace(/^#/, ''); if (v && !tags.includes(v)) setTags([...tags, v]); setTagDraft(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!(amt > 0)) return setError('Enter an amount greater than 0.');
    if (!accountId) return setError('Choose an account.');
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) return setError('Choose a different destination account.');
    const data = { type, amount: amt, accountId, toAccountId: type === 'transfer' ? toAccountId : undefined, category: category.trim() || (type === 'income' ? 'Income' : 'General'), date, time, currency, merchant: merchant.trim(), description: description.trim(), notes: notes.trim(), tags };
    await db.transaction('rw', db.financeTransactions, db.financeAccounts, async () => {
      const delta: Record<string, number> = {};
      if (transaction) for (const [id, v] of Object.entries(balanceEffects(transaction))) delta[id] = (delta[id] || 0) - v; // reverse old effect
      for (const [id, v] of Object.entries(balanceEffects(data))) delta[id] = (delta[id] || 0) + v;
      if (transaction) await db.financeTransactions.update(transaction.id, data);
      else await db.financeTransactions.add({ id: `tx-${Date.now()}`, ...data, createdAt: new Date().toISOString() });
      for (const [id, v] of Object.entries(delta)) { if (!v) continue; const a = await db.financeAccounts.get(id); if (a) await db.financeAccounts.update(id, { balance: a.balance + v }); }
    });
    if (!transaction) { setAmount(''); setMerchant(''); setDescription(''); setNotes(''); setTags([]); }
    setError(''); onDone();
  };

  const TYPES: [TxType, string][] = [['expense', 'Expense'], ['income', 'Income'], ['transfer', 'Transfer']];
  return (
    <form onSubmit={submit} aria-label="Transaction form" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      <div role="radiogroup" aria-label="Transaction type" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {TYPES.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={type === v} className="btn btn-xs" style={{ borderRadius: 0, height: 36, background: type === v ? 'var(--accent-primary)' : 'var(--bg-surface)', color: type === v ? 'var(--text-on-accent)' : 'var(--text-primary)' }} onClick={() => setType(v)}>{l}</button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 8 }}>
        <div className="form-group"><label className="form-label" htmlFor="tx-amount">Amount</label><input id="tx-amount" className="form-input num" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div className="form-group"><label className="form-label" htmlFor="tx-currency">Currency</label><select id="tx-currency" className="form-select" value={currency} onChange={(e) => void setGlobalCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select></div>
      </div>
      <div className="form-group"><label className="form-label" htmlFor="tx-account">{type === 'transfer' ? 'From account' : 'Account'}</label>
        <select id="tx-account" className="form-select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.length === 0 && <option value="">No accounts — add one in Accounts</option>}{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
      {type === 'transfer' && <div className="form-group"><label className="form-label" htmlFor="tx-to">To account</label><select id="tx-to" className="form-select" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}><option value="">Select…</option>{accounts.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
      <div className="form-group"><label className="form-label" htmlFor="tx-category">Category</label><input id="tx-category" className="form-input" list="tx-categories" value={category} placeholder="Food, Transport…" onChange={(e) => setCategory(e.target.value)} /><datalist id="tx-categories">{[...DEFAULT_CATEGORIES, ...known].map((c) => <option key={c} value={c} />)}</datalist></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="form-group"><label className="form-label" htmlFor="tx-date">Date</label><input id="tx-date" className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="form-group"><label className="form-label" htmlFor="tx-time">Time</label><input id="tx-time" className="form-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
      </div>
      <div className="form-group"><label className="form-label" htmlFor="tx-merchant">Merchant (optional)</label><input id="tx-merchant" className="form-input" placeholder="e.g. Zomato, Amazon" value={merchant} onChange={(e) => setMerchant(e.target.value)} /></div>
      <div className="form-group"><label className="form-label" htmlFor="tx-desc">Description (optional)</label><input id="tx-desc" className="form-input" placeholder="e.g. Lunch with friends" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="form-group"><label className="form-label" htmlFor="tx-notes">Notes (optional)</label><textarea id="tx-notes" className="form-textarea" rows={2} placeholder="Add a note…" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div className="form-group"><label className="form-label" htmlFor="tx-tag">Tags</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {tags.map((t) => <span key={t} className="chip chip-neutral">#{t}<button type="button" className="link-action" style={{ padding: 0 }} aria-label={`Remove tag ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}><X size={11} /></button></span>)}
          <input id="tx-tag" className="form-input" style={{ width: 110, minHeight: 30, padding: '0.2rem 0.5rem' }} placeholder="Add tag" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }} />
          <button type="button" className="btn btn-secondary btn-xs" aria-label="Add tag" onClick={addTag}><Plus size={12} /></button>
        </div></div>
      {error && <p role="alert" className="chip chip-danger" style={{ alignSelf: 'flex-start' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        {onCancel && <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>{transaction ? 'Update Transaction' : 'Save Transaction'}</button>
      </div>
    </form>
  );
};
