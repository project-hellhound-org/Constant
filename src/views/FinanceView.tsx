import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, FinanceTransaction, FinanceAccount, FinanceBudget, FinanceSavingsGoal } from '../db/schema';
import { Plus, Trash2, Edit3, DollarSign, ArrowUpRight, ArrowDownLeft, RefreshCw, Wallet, PiggyBank, PieChart, Tag as TagIcon, CreditCard, Landmark, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { FinanceOverview } from '../components/FinanceOverview';
import { TransactionForm } from '../components/TransactionForm';
import { CURRENCIES, money, useCurrency } from '../lib/currency';

export const FinanceView: React.FC = () => {
  const accounts = useLiveQuery(() => db.financeAccounts.toArray()) || [];
  const transactions = useLiveQuery(() => db.financeTransactions.toArray()) || [];
  const budgets = useLiveQuery(() => db.financeBudgets.toArray()) || [];
  const savingsGoals = useLiveQuery(() => db.financeSavingsGoals.toArray()) || [];
  const [currency, setCurrency] = useCurrency();

  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'accounts' | 'budgets' | 'savings'>('overview');
  const [timeframe, setTimeframe] = useState<'monthly' | 'weekly' | 'yearly' | 'all'>('monthly');

  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txToEdit, setTxToEdit] = useState<FinanceTransaction | null>(null);


  // Account Modal
  const [isAccModalOpen, setIsAccModalOpen] = useState(false);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<'cash' | 'bank' | 'upi' | 'credit_card' | 'savings' | 'investment'>('bank');
  const [accBalance, setAccBalance] = useState<number | ''>('');
  const [accToEdit, setAccToEdit] = useState<FinanceAccount | null>(null);

  // Budget Modal
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budCategory, setBudCategory] = useState('');
  const [budLimit, setBudLimit] = useState<number | ''>('');

  // Savings Goal Modal
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState<number | ''>('');
  const [goalCurrent, setGoalCurrent] = useState<number | ''>('');

  // Handle default account initialization
  const defaultAccountId = accounts.length > 0 ? accounts[0].id : '';

  // Calculate totals derived from transactions
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const netCashFlow = totalIncome - totalExpenses;

  const totalAccountBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);

  const handleDeleteTransaction = async (tx: FinanceTransaction) => {
    if (confirm('Delete this transaction?')) {
      await db.financeTransactions.delete(tx.id);
    }
  };

  const openAccountModal = (acc: FinanceAccount | null) => {
    setAccToEdit(acc); setAccName(acc?.name ?? ''); setAccType(acc?.type ?? 'bank'); setAccBalance(acc ? acc.balance : ''); setIsAccModalOpen(true);
  };

  // Add or edit account
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;
    const balance = typeof accBalance === 'number' ? accBalance : 0;
    if (accToEdit) await db.financeAccounts.update(accToEdit.id, { name: accName.trim(), type: accType, balance, currency });
    else await db.financeAccounts.add({ id: `acc-${Date.now()}`, name: accName.trim(), type: accType, balance, currency, createdAt: new Date().toISOString() });
    setIsAccModalOpen(false); setAccToEdit(null); setAccName(''); setAccBalance('');
  };

  // Remove account (and the transactions recorded against it)
  const handleDeleteAccount = async (acc: FinanceAccount) => {
    const linked = transactions.filter((t) => t.accountId === acc.id || t.toAccountId === acc.id);
    const msg = linked.length ? `Delete "${acc.name}" and its ${linked.length} transaction${linked.length === 1 ? '' : 's'}? This cannot be undone.` : `Delete "${acc.name}"? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    await db.transaction('rw', db.financeAccounts, db.financeTransactions, async () => {
      await db.financeTransactions.bulkDelete(linked.map((t) => t.id));
      await db.financeAccounts.delete(acc.id);
    });
  };

  // Add Budget
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budCategory.trim() || typeof budLimit !== 'number') return;

    await db.financeBudgets.add({
      id: `bud-${Date.now()}`,
      category: budCategory.trim(),
      amountLimit: budLimit,
      period: 'monthly',
      startDate: format(new Date(), 'yyyy-MM-dd'),
    });

    setIsBudgetModalOpen(false);
    setBudCategory('');
    setBudLimit('');
  };

  // Add Savings Goal
  const handleSaveSavingsGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim() || typeof goalTarget !== 'number') return;

    await db.financeSavingsGoals.add({
      id: `sg-${Date.now()}`,
      title: goalTitle.trim(),
      targetAmount: goalTarget,
      currentAmount: typeof goalCurrent === 'number' ? goalCurrent : 0,
    });

    setIsGoalModalOpen(false);
    setGoalTitle('');
    setGoalTarget('');
    setGoalCurrent('');
  };

  return (
    <div className="view-container">
      {/* Header */}
      <div className="view-header">
        <div>
          <h1 className="view-header-title">Finance</h1>
          <p className="view-header-subtitle">
            Track your income, expenses, savings and build a better financial future.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <label className="form-label" htmlFor="fin-currency" style={{ margin: 0 }}>Currency</label>
          <select id="fin-currency" className="form-select" value={currency} onChange={(e) => void setCurrency(e.target.value)} style={{ minHeight: 40 }}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => { setTxToEdit(null); setIsTxModalOpen(true); }}>
            <Plus size={16} /> Add Transaction
          </button>
        </div>
      </div>

      {/* Finance Module Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'transactions', label: 'Transactions' },
          { id: 'accounts', label: 'Accounts' },
          { id: 'budgets', label: 'Budgets' },
          { id: 'savings', label: 'Savings Goals' },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            onClick={() => setActiveTab(tab.id as any)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && <FinanceOverview accounts={accounts} transactions={transactions} budgets={budgets} goals={savingsGoals} onViewAll={() => setActiveTab('transactions')} />}

      {/* Tab 2: Full Transactions Table */}
      {activeTab === 'transactions' && (
        <div className="liquid-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>
            Authoritative Transactions Log
          </h3>
          {transactions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No transactions found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.75rem' }}>Date</th>
                    <th style={{ padding: '0.75rem' }}>Type</th>
                    <th style={{ padding: '0.75rem' }}>Category / Merchant</th>
                    <th style={{ padding: '0.75rem' }}>Amount</th>
                    <th style={{ padding: '0.75rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{tx.date}</td>
                      <td style={{ padding: '0.75rem', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: tx.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>
                        {tx.type}
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {tx.merchant ? `${tx.merchant} (${tx.category})` : tx.category}
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: 800, color: tx.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>
                        {tx.type === 'income' ? '+' : '−'}{money(tx.amount, currency)}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <button className="btn btn-danger btn-icon" onClick={() => handleDeleteTransaction(tx)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Accounts Management */}
      {activeTab === 'accounts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => openAccountModal(null)}>
              <Plus size={16} /> Add Financial Account
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {accounts.map((acc) => (
              <div key={acc.id} className="liquid-panel" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>{acc.name}</h4>
                  <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'var(--accent-soft)', color: 'var(--accent-secondary)', borderRadius: 'var(--radius-sm)' }}>
                    {acc.type}
                  </span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.5rem 0' }}>
                  {money(acc.balance, currency)}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" className="btn btn-secondary btn-xs" aria-label={`Edit account ${acc.name}`} onClick={() => openAccountModal(acc)}>Edit</button>
                  <button type="button" className="btn btn-danger btn-xs" aria-label={`Delete account ${acc.name}`} onClick={() => handleDeleteAccount(acc)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Budgets */}
      {activeTab === 'budgets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => setIsBudgetModalOpen(true)}>
              <Plus size={16} /> Create Category Budget
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {budgets.map((b) => {
              const spent = transactions
                .filter((t) => t.category.toLowerCase() === b.category.toLowerCase() && t.type === 'expense')
                .reduce((acc, curr) => acc + curr.amount, 0);
              const pct = Math.min(100, Math.round((spent / b.amountLimit) * 100));

              return (
                <div key={b.id} className="liquid-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontWeight: 700 }}>{b.category}</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.period}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>Spent: <strong>{money(spent, currency)}</strong></span>
                    <span>Limit: <strong>{money(b.amountLimit, currency)}</strong></span>
                  </div>
                  <div className="progress-bar-track" style={{ height: '7px' }}>
                    <div className="progress-bar-fill" style={{ width: `${pct}%`, background: pct > 90 ? 'var(--danger)' : 'var(--accent-primary)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 5: Savings Goals */}
      {activeTab === 'savings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => setIsGoalModalOpen(true)}>
              <Plus size={16} /> Create Savings Goal
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {savingsGoals.map((sg) => {
              const pct = Math.min(100, Math.round((sg.currentAmount / sg.targetAmount) * 100));
              return (
                <div key={sg.id} className="liquid-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontWeight: 700 }}>{sg.title}</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>Saved: <strong>{money(sg.currentAmount, currency)}</strong></span>
                    <span>Target: <strong>{money(sg.targetAmount, currency)}</strong></span>
                  </div>
                  <div className="progress-bar-track" style={{ height: '7px' }}>
                    <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Record Transaction Modal */}
      {isTxModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--overlay)',
            
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setIsTxModalOpen(false)}
        >
          <div
            className="liquid-panel"
            style={{ width: '100%', maxWidth: '460px', maxHeight: '92vh', overflowY: 'auto', padding: '1.5rem', background: 'var(--bg-elevated)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontWeight: 800 }}>{txToEdit ? 'Edit Transaction' : 'Add Transaction'}</h3>
            <TransactionForm accounts={accounts} transaction={txToEdit} onDone={() => setIsTxModalOpen(false)} onCancel={() => setIsTxModalOpen(false)} />
          </div>
        </div>
      )}

      {/* Account Modal */}
      {isAccModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)',  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setIsAccModalOpen(false)}>
          <div className="liquid-panel" style={{ width: '100%', maxWidth: '400px', padding: '1.5rem', background: 'var(--bg-secondary)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem 0', fontWeight: 800 }}>{accToEdit ? 'Edit Financial Account' : 'Add Financial Account'}</h3>
            <form onSubmit={handleSaveAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Account Name *</label>
                <input type="text" className="form-input" required placeholder="e.g. Chase Checking, HDFC Bank, Cash..." value={accName} onChange={(e) => setAccName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Account Type *</label>
                <select className="form-select" value={accType} onChange={(e) => setAccType(e.target.value as any)}>
                  <option value="bank">Bank Account</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI Wallet</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="savings">Savings Account</option>
                  <option value="investment">Investment Portfolio</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{accToEdit ? 'Current' : 'Initial'} Balance ({currency}) *</label>
                <input type="number" step="0.01" className="form-input" required placeholder="0.00" value={accBalance} onChange={(e) => setAccBalance(e.target.value ? parseFloat(e.target.value) : '')} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setIsAccModalOpen(false); setAccToEdit(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">{accToEdit ? 'Save Account' : 'Add Account'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Budget Modal */}
      {isBudgetModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)',  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setIsBudgetModalOpen(false)}>
          <div className="liquid-panel" style={{ width: '100%', maxWidth: '400px', padding: '1.5rem', background: 'var(--bg-secondary)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem 0', fontWeight: 800 }}>Create Category Budget</h3>
            <form onSubmit={handleSaveBudget} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <input type="text" className="form-input" required placeholder="e.g. Dining, Shopping, Subscriptions..." value={budCategory} onChange={(e) => setBudCategory(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Monthly Limit ({currency}) *</label>
                <input type="number" step="0.01" className="form-input" required placeholder="500.00" value={budLimit} onChange={(e) => setBudLimit(e.target.value ? parseFloat(e.target.value) : '')} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsBudgetModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Budget</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Savings Goal Modal */}
      {isGoalModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)',  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setIsGoalModalOpen(false)}>
          <div className="liquid-panel" style={{ width: '100%', maxWidth: '400px', padding: '1.5rem', background: 'var(--bg-secondary)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem 0', fontWeight: 800 }}>Create Savings Goal</h3>
            <form onSubmit={handleSaveSavingsGoal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Goal Title *</label>
                <input type="text" className="form-input" required placeholder="e.g. Emergency Fund, Laptop Upgrade..." value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Target Amount ({currency}) *</label>
                <input type="number" step="0.01" className="form-input" required placeholder="1000.00" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value ? parseFloat(e.target.value) : '')} />
              </div>
              <div className="form-group">
                <label className="form-label">Currently Saved ({currency})</label>
                <input type="number" step="0.01" className="form-input" placeholder="0.00" value={goalCurrent} onChange={(e) => setGoalCurrent(e.target.value ? parseFloat(e.target.value) : '')} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsGoalModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Goal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
