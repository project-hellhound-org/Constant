import React, { useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { addDays, addMonths, addWeeks, addYears, eachDayOfInterval, eachMonthOfInterval, endOfDay, endOfMonth, endOfWeek, endOfYear, format, parseISO, startOfDay, startOfMonth, startOfWeek, startOfYear } from 'date-fns';
import { ChevronLeft, ChevronRight, ArrowDownRight, ArrowUpRight, Landmark, Wallet } from 'lucide-react';
import { FinanceAccount, FinanceBudget, FinanceSavingsGoal, FinanceTransaction } from '../db/schema';
import { TransactionForm } from './TransactionForm';
import { money, useCurrency } from '../lib/currency';
import { ProgressRing } from './ui';

type Period = 'day' | 'week' | 'month' | 'year';
const VARS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)'];
const AXIS = { fontSize: 11, fill: 'var(--chart-axis)' } as const;
const tip = { contentStyle: { background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }, cursor: { fill: 'var(--surface-hover)' } } as const;

const bounds = (p: Period, d: Date): [Date, Date] => p === 'day' ? [startOfDay(d), endOfDay(d)] : p === 'week' ? [startOfWeek(d, { weekStartsOn: 1 }), endOfWeek(d, { weekStartsOn: 1 })] : p === 'month' ? [startOfMonth(d), endOfMonth(d)] : [startOfYear(d), endOfYear(d)];
const shift = (p: Period, d: Date, n: number) => p === 'day' ? addDays(d, n) : p === 'week' ? addWeeks(d, n) : p === 'month' ? addMonths(d, n) : addYears(d, n);
const label = (p: Period, d: Date) => { const [a, b] = bounds(p, d); return p === 'day' ? format(d, 'MMM d, yyyy') : p === 'week' ? `${format(a, 'MMM d')} – ${format(b, 'MMM d, yyyy')}` : p === 'month' ? format(d, 'MMMM yyyy') : format(d, 'yyyy'); };

interface Props { accounts: FinanceAccount[]; transactions: FinanceTransaction[]; budgets: FinanceBudget[]; goals: FinanceSavingsGoal[]; onViewAll: () => void }

export const FinanceOverview: React.FC<Props> = ({ accounts, transactions, budgets, goals, onViewAll }) => {
  const [period, setPeriod] = useState<Period>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [cur] = useCurrency();

  const inRange = (a: Date, b: Date) => transactions.filter((t) => { const d = parseISO(t.date); return d >= a && d <= b; });
  const sum = (arr: FinanceTransaction[], type: FinanceTransaction['type']) => arr.filter((t) => t.type === type).reduce((x, t) => x + t.amount, 0);
  const [from, to] = bounds(period, anchor);
  const [pFrom, pTo] = bounds(period, shift(period, anchor, -1));
  const now = inRange(from, to), prev = inRange(pFrom, pTo);
  const income = sum(now, 'income'), spend = sum(now, 'expense'), savings = income - spend;
  const pIncome = sum(prev, 'income'), pSpend = sum(prev, 'expense'), pSave = pIncome - pSpend;
  const rate = income > 0 ? Math.round((savings / income) * 1000) / 10 : 0;
  const pRate = pIncome > 0 ? Math.round((pSave / pIncome) * 1000) / 10 : 0;
  const chg = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null);

  const expenses = now.filter((t) => t.type === 'expense');
  const cats = useMemo(() => { const m = new Map<string, number>(); expenses.forEach((t) => m.set(t.category, (m.get(t.category) || 0) + t.amount)); return [...m.entries()].sort((a, b) => b[1] - a[1]); }, [expenses]);
  const topCats = cats.slice(0, 6).map(([c]) => c);

  const buckets = useMemo(() => {
    const monthly = period === 'year';
    const points = monthly ? eachMonthOfInterval({ start: from, end: to }) : eachDayOfInterval({ start: from, end: to });
    let running = 0;
    return points.map((d) => {
      const key = monthly ? format(d, 'yyyy-MM') : format(d, 'yyyy-MM-dd');
      const txs = now.filter((t) => (monthly ? t.date.slice(0, 7) : t.date) === key);
      const row: Record<string, number | string> = { label: monthly ? format(d, 'MMM') : format(d, 'd MMM') };
      let other = 0;
      txs.filter((t) => t.type === 'expense').forEach((t) => { if (topCats.includes(t.category)) row[t.category] = ((row[t.category] as number) || 0) + t.amount; else other += t.amount; });
      if (other) row.Other = other;
      const inc = sum(txs, 'income'), exp = sum(txs, 'expense'); running += inc - exp;
      return { ...row, Income: inc, Expenses: exp, Savings: running } as Record<string, number | string>;
    });
  }, [now, period, from, to, topCats.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const stackKeys = [...topCats, ...(buckets.some((b) => !!(b as Record<string, number | string>).Other) ? ['Other'] : [])];

  const accName = (id: string) => accounts.find((a) => a.id === id)?.name || '—';
  const total = cats.reduce((a, [, v]) => a + v, 0);
  const Card: React.FC<{ title: string; value: string; change: number | null; icon: React.ReactNode; invert?: boolean }> = ({ title, value, change, icon, invert }) => (
    <div className="liquid-panel" style={{ display: 'flex', gap: '0.9rem', alignItems: 'center' }}>
      <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>{icon}</span>
      <div><div className="subtitle" style={{ fontSize: '0.8rem', fontWeight: 600 }}>{title}</div><div className="num" style={{ fontSize: '1.45rem', fontWeight: 700 }}>{value}</div>
        {change !== null ? <span className="num" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '0.75rem', fontWeight: 600, color: (change >= 0) !== !!invert ? 'var(--success)' : 'var(--danger)' }}>{change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{change >= 0 ? '+' : '−'}{Math.abs(change)}% vs last {period}</span> : <span className="subtitle" style={{ fontSize: '0.74rem' }}>No data last {period}</span>}</div>
    </div>);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1rem', alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-icon" aria-label="Previous period" onClick={() => setAnchor(shift(period, anchor, -1))}><ChevronLeft size={16} /></button>
          <strong className="num" style={{ minWidth: 150, textAlign: 'center' }}>{label(period, anchor)}</strong>
          <button className="btn btn-secondary btn-icon" aria-label="Next period" onClick={() => setAnchor(shift(period, anchor, 1))}><ChevronRight size={16} /></button>
          <div role="radiogroup" aria-label="Period" style={{ display: 'inline-flex', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginLeft: 'auto' }}>
            {(['day', 'week', 'month', 'year'] as Period[]).map((p) => <button key={p} type="button" role="radio" aria-checked={period === p} className="btn btn-xs" style={{ borderRadius: 0, height: 36, background: period === p ? 'var(--accent-primary)' : 'var(--bg-surface)', color: period === p ? 'var(--text-on-accent)' : 'var(--text-primary)' }} onClick={() => setPeriod(p)}>{{ day: 'Today', week: 'Week', month: 'Month', year: 'Year' }[p]}</button>)}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
          <Card title="Total Income" value={money(income, cur)} change={chg(income, pIncome)} icon={<Wallet size={22} />} />
          <Card title="Total Expenses" value={money(spend, cur)} change={chg(spend, pSpend)} icon={<ArrowDownRight size={22} />} invert />
          <Card title="Total Savings" value={money(savings, cur)} change={chg(savings, pSave)} icon={<Landmark size={22} />} />
          <div className="liquid-panel" style={{ display: 'flex', gap: '0.9rem', alignItems: 'center' }}><ProgressRing pct={Math.max(0, rate)} size={56} /><div><div className="subtitle" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Savings Rate</div><div className="num" style={{ fontSize: '1.3rem', fontWeight: 700 }}>{rate}%</div><span className="num subtitle" style={{ fontSize: '0.74rem' }}>{rate - pRate >= 0 ? '+' : '−'}{Math.abs(Math.round((rate - pRate) * 10) / 10)} pts vs last {period}</span></div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
          <section className="liquid-panel" aria-label="Spending by category"><h3 className="panel-title">Spending by Category</h3><p className="subtitle" style={{ fontSize: '0.75rem', marginBottom: 8 }}>Expenses grouped by category (stacked columns)</p>
            <div style={{ height: 250 }}><ResponsiveContainer><BarChart data={buckets} margin={{ left: -8, right: 4 }}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={AXIS} interval="preserveStartEnd" minTickGap={16} /><YAxis tick={AXIS} /><Tooltip {...tip} formatter={(v) => money(Number(v), cur)} /><Legend wrapperStyle={{ fontSize: 11 }} />{stackKeys.map((k, i) => <Bar key={k} dataKey={k} stackId="s" fill={VARS[i % VARS.length]} isAnimationActive={false} />)}</BarChart></ResponsiveContainer></div></section>
          <section className="liquid-panel" aria-label="Income vs expenses vs savings"><h3 className="panel-title">Income vs Expenses vs Savings</h3><p className="subtitle" style={{ fontSize: '0.75rem', marginBottom: 8 }}>Financial trend over time (savings is cumulative)</p>
            <div style={{ height: 250 }}><ResponsiveContainer><LineChart data={buckets} margin={{ left: -8, right: 8 }}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={AXIS} interval="preserveStartEnd" minTickGap={16} /><YAxis tick={AXIS} /><Tooltip {...tip} formatter={(v) => money(Number(v), cur)} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="Income" stroke="var(--chart-3)" strokeWidth={2.2} dot={false} isAnimationActive={false} /><Line dataKey="Expenses" stroke="var(--chart-4)" strokeWidth={2.2} strokeDasharray="5 4" dot={false} isAnimationActive={false} /><Line dataKey="Savings" stroke="var(--chart-1)" strokeWidth={2.2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></section>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <section className="liquid-panel" aria-label="Category breakdown"><h3 className="panel-title" style={{ marginBottom: 8 }}>Category Breakdown</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', width: 140, height: 140, flex: 'none' }}><ResponsiveContainer><PieChart><Pie data={total ? cats.map(([name, value]) => ({ name, value })) : [{ name: 'none', value: 1 }]} dataKey="value" innerRadius={46} outerRadius={66} stroke="var(--bg-surface)" strokeWidth={2} isAnimationActive={false}>{(total ? cats : [['none', 1]]).map((c, i) => <Cell key={String(c[0])} fill={total ? VARS[i % VARS.length] : 'var(--progress-track)'} />)}</Pie></PieChart></ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><strong className="num" style={{ fontSize: '0.95rem' }}>{money(total, cur)}</strong><span className="subtitle" style={{ fontSize: '0.68rem' }}>Total Spent</span></div></div>
              <ul style={{ listStyle: 'none', flex: 1, fontSize: '0.8rem' }}>{cats.slice(0, 7).map(([c, v], i) => <li key={c} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '2px 0' }}><span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 2, background: VARS[i % VARS.length] }} /><span style={{ flex: 1 }}>{c}</span><span className="num subtitle">{Math.round((v / total) * 100)}%</span><span className="num">{money(v, cur)}</span></li>)}{!cats.length && <li className="subtitle">No spending in this period.</li>}</ul>
            </div></section>
          <section className="liquid-panel" aria-label="Budget progress"><h3 className="panel-title" style={{ marginBottom: 8 }}>Budget Progress</h3>
            {budgets.length === 0 ? <p className="subtitle" style={{ fontSize: '0.85rem' }}>No budgets yet. Create one in the Budgets tab.</p> : budgets.slice(0, 5).map((b) => { const used = expenses.filter((t) => t.category.toLowerCase() === b.category.toLowerCase()).reduce((a, t) => a + t.amount, 0); const p = b.amountLimit ? Math.round((used / b.amountLimit) * 100) : 0; return (
              <div key={b.id} style={{ padding: '0.35rem 0' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}><span>{b.category}</span><span className="num">{money(used, cur)} / {money(b.amountLimit, cur)} · {p}%{p > 100 ? ' (over)' : ''}</span></div><div className="progress-bar-track" style={{ height: 6 }}><div style={{ width: `${Math.min(100, p)}%`, height: '100%', borderRadius: 999, background: p > 100 ? 'var(--danger)' : p > 80 ? 'var(--warning)' : 'var(--success)' }} /></div></div>); })}</section>
          <section className="liquid-panel" aria-label="Savings goals"><h3 className="panel-title" style={{ marginBottom: 8 }}>Savings Goals</h3>
            {goals.length === 0 ? <p className="subtitle" style={{ fontSize: '0.85rem' }}>No savings goals yet.</p> : goals.slice(0, 4).map((g) => { const p = g.targetAmount ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0; return (
              <div key={g.id} style={{ padding: '0.35rem 0' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}><span>{g.title}</span><span className="num">{p}%</span></div><div className="progress-bar-track" style={{ height: 6 }}><div className="progress-bar-fill" style={{ width: `${Math.min(100, p)}%` }} /></div><div className="num subtitle" style={{ fontSize: '0.72rem' }}>{money(g.currentAmount, cur)} / {money(g.targetAmount, cur)}</div></div>); })}</section>
        </div>

        <section className="liquid-panel" aria-label="Recent transactions">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><h3 className="panel-title">Recent Transactions</h3><button type="button" className="link-action" onClick={onViewAll}>View All →</button></div>
          {now.length === 0 ? <p className="subtitle" style={{ fontSize: '0.85rem' }}>No transactions in this period.</p> : (
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>{['Date', 'Description', 'Category', 'Account', 'Amount'].map((h, i) => <th key={h} scope="col" style={{ padding: '0.4rem 0.5rem', textAlign: i === 4 ? 'right' : 'left', fontWeight: 600 }}>{h}</th>)}</tr></thead>
              <tbody>{[...now].sort((a, b) => `${b.date}${b.time || ''}`.localeCompare(`${a.date}${a.time || ''}`)).slice(0, 6).map((t) => <tr key={t.id} style={{ borderTop: '1px solid var(--divider)' }}><td className="num" style={{ padding: '0.5rem' }}>{format(parseISO(t.date), 'MMM d, yyyy')}</td><td style={{ padding: '0.5rem' }}>{t.merchant || t.description || t.category}</td><td style={{ padding: '0.5rem' }}><span className="chip chip-neutral">{t.category}</span></td><td style={{ padding: '0.5rem' }}>{accName(t.accountId)}</td>
                <td className="num" style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: t.type === 'income' || t.type === 'refund' ? 'var(--success)' : 'var(--danger)' }}>{t.type === 'income' || t.type === 'refund' ? '+' : '−'}{money(t.amount, cur)}</td></tr>)}</tbody></table></div>)}
        </section>
      </div>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} aria-label="Add transaction and accounts">
        <section className="liquid-panel" aria-label="Add transaction"><h3 className="panel-title" style={{ marginBottom: 10 }}>Add Transaction</h3><TransactionForm accounts={accounts} onDone={() => undefined} /></section>
        <section className="liquid-panel" aria-label="Accounts"><h3 className="panel-title" style={{ marginBottom: 8 }}>Accounts</h3>
          {accounts.length === 0 ? <p className="subtitle" style={{ fontSize: '0.85rem' }}>No accounts yet. Add a bank, savings, wallet or cash account in the Accounts tab.</p> : accounts.map((a) => <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderTop: '1px solid var(--divider)', fontSize: '0.86rem' }}><span>{a.name} <span className="chip chip-neutral" style={{ marginLeft: 4 }}>{a.type.replace('_', ' ')}</span></span><strong className="num" style={{ color: a.balance < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{money(a.balance, cur)}</strong></div>)}</section>
      </aside>
    </div>
  );
};
