/** Delivers OS-level notifications: Capacitor (Android/iOS) when available, otherwise the Web Notification API (Electron, browsers, PWA). */
type Permission = 'granted' | 'denied' | 'default' | 'unsupported';

const cap = (): any => (typeof window !== 'undefined' ? (window as any).Capacitor : undefined);
const nativePlugin = (): any => { const c = cap(); return c?.isNativePlatform?.() ? c.Plugins?.LocalNotifications : undefined; };

export function notificationPermission(): Permission {
  if (nativePlugin()) return 'default';
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as Permission;
}

export async function requestNotificationPermission(): Promise<Permission> {
  const native = nativePlugin();
  if (native) { try { const r = await native.requestPermissions(); return r.display === 'granted' ? 'granted' : 'denied'; } catch { return 'denied'; } }
  if (typeof Notification === 'undefined') return 'unsupported';
  try { return (await Notification.requestPermission()) as Permission; } catch { return 'denied'; }
}

let nativeId = 1;
export async function sendSystemNotification(title: string, body: string, tag?: string): Promise<boolean> {
  const native = nativePlugin();
  if (native) {
    try { await native.schedule({ notifications: [{ id: nativeId++ % 2147483647, title, body, schedule: { at: new Date(Date.now() + 500) } }] }); return true; } catch { return false; }
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try { new Notification(title, { body, tag, icon: './icon.png' }); return true; } catch { return false; }
}

/** Native only: repeating daily reminders keep firing while the app is closed. Fire-and-forget; no-op elsewhere. */
export async function syncNativeDailyReminders(items: { id: number; title: string; body: string; time: string }[]): Promise<void> {
  const native = nativePlugin();
  if (!native) return;
  try {
    const pending = await native.getPending();
    if (pending?.notifications?.length) await native.cancel({ notifications: pending.notifications.map((n: any) => ({ id: n.id })) });
    if (!items.length) return;
    await native.schedule({ notifications: items.map((i) => ({ id: i.id, title: i.title, body: i.body, schedule: { on: { hour: Number(i.time.slice(0, 2)), minute: Number(i.time.slice(3, 5)) }, allowWhileIdle: true } })) });
  } catch { /* best effort */ }
}
