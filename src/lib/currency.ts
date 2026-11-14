import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';

export const CURRENCIES: { code: string; name: string }[] = [
  { code: 'USD', name: 'US Dollar' }, { code: 'INR', name: 'Indian Rupee' }, { code: 'RUB', name: 'Russian Ruble' }, { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' }, { code: 'JPY', name: 'Japanese Yen' }, { code: 'CNY', name: 'Chinese Yuan' }, { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' }, { code: 'CHF', name: 'Swiss Franc' }, { code: 'AED', name: 'UAE Dirham' }, { code: 'BRL', name: 'Brazilian Real' }, { code: 'KRW', name: 'South Korean Won' },
];
export const DEFAULT_CURRENCY = 'USD';
export const isCurrency = (c: unknown): c is string => typeof c === 'string' && CURRENCIES.some((x) => x.code === c);

/** Formats an amount in the given currency (no conversion). Falls back to "CODE 1,234" if Intl lacks the code. */
export function money(amount: number, currency: string = DEFAULT_CURRENCY): string {
  const code = isCurrency(currency) ? currency : DEFAULT_CURRENCY;
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${code} ${amount.toLocaleString()}`; }
}

/** The user's chosen currency. It is stored once and applied to every finance entry until changed manually. */
export function useCurrency(): [string, (c: string) => Promise<void>] {
  const settings = useLiveQuery(() => db.settings.get('default'));
  const currency = isCurrency(settings?.financeCurrency) ? (settings!.financeCurrency as string) : DEFAULT_CURRENCY;
  const setCurrency = useCallback(async (c: string) => { if (isCurrency(c)) await db.settings.update('default', { financeCurrency: c }); }, []);
  return [currency, setCurrency];
}
