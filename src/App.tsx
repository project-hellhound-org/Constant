<<<<<<< HEAD
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { initializeDatabase } from './db/seed';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { NotificationHost } from './notifications/NotificationHost';
import { DashboardView } from './views/DashboardView';
import { HabitsView } from './views/HabitsView';
import { DoListView } from './views/DoListView';
=======
import React, { useState, useEffect } from 'react';
import { initializeDatabase } from './db/seed';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ContextualSidebarDrawer } from './components/ContextualSidebarDrawer';
import { DashboardView } from './views/DashboardView';
import { HabitsView } from './views/HabitsView';
import { DoListView } from './views/DoListView';
import { AnalyticsView } from './views/AnalyticsView';
import { CalendarView } from './views/CalendarView';
import { InsightsView } from './views/InsightsView';
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
import { SettingsView } from './views/SettingsView';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/schema';
import { Brand } from './components/Brand';
import { LoginPortal } from './components/LoginPortal';
<<<<<<< HEAD
import { hasAccount, isSessionActive, endSession, greetingFor } from './auth/account';
import { RESET_EVENT } from './views/SettingsView';

// Heavy views are split into their own chunks so the main bundle stays small.
const AnalyticsView = lazy(() => import('./views/AnalyticsView').then((m) => ({ default: m.AnalyticsView })));
const InsightsView = lazy(() => import('./views/InsightsView').then((m) => ({ default: m.InsightsView })));
const NotepadView = lazy(() => import('./views/NotepadView').then((m) => ({ default: m.NotepadView })));
const FinanceView = lazy(() => import('./views/FinanceView').then((m) => ({ default: m.FinanceView })));
const CalendarView = lazy(() => import('./views/CalendarView').then((m) => ({ default: m.CalendarView })));
=======
import { hasAccount, isSessionActive, endSession } from './auth/account';
import { RESET_EVENT } from './views/SettingsView';
import { NotepadView } from './views/NotepadView';
import { FinanceView } from './views/FinanceView';
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e

export type ActiveTab =
  | 'dashboard'
  | 'habits'
  | 'dolist'
  | 'analytics'
  | 'calendar'
  | 'finance'
  | 'workspace'
  | 'insights'
  | 'settings';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [sessionOn, setSessionOn] = useState(isSessionActive());
  const settings = useLiveQuery(() => db.settings.get('default'));

<<<<<<< HEAD
  useEffect(() => {
    const onReset = () => { endSession(); setSessionOn(false); setActiveTab('dashboard'); };
=======
  // Contextual Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);

  useEffect(() => {
    const onReset = () => { endSession(); setSessionOn(false); setActiveTab('dashboard'); setIsDrawerOpen(false); };
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
    window.addEventListener(RESET_EVENT, onReset);
    return () => window.removeEventListener(RESET_EVENT, onReset);
  }, []);

  useEffect(() => {
    initializeDatabase().then(() => {
      setIsInitialized(true);
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 700);
      return () => clearTimeout(timer);
    });
  }, []);

  if (!isInitialized || showSplash || settings === undefined) {
    return (
<<<<<<< HEAD
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-primary)', backgroundImage: 'var(--bg-image, none)', backgroundSize: 'cover', backgroundPosition: 'center', color: 'var(--text-primary)', position: 'relative' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--bg-scrim, transparent)' }} />
        <div className="app-launch-reveal" role="status" aria-label="CONSTANT, Personalized Routine Tracker, loading" style={{ position: 'relative' }}>
          <Brand size="lg" align="center" />
          {sessionOn && hasAccount(settings) && (
            <p aria-live="polite" style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>{greetingFor(settings?.userName)}</p>
          )}
=======
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)', backgroundImage: 'var(--bg-image, none)', backgroundSize: 'cover', backgroundPosition: 'center', color: 'var(--text-primary)', position: 'relative' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--bg-scrim, transparent)' }} />
        <div className="app-launch-reveal" role="status" aria-label="CONSTANT, Personalized Routine Tracker, loading" style={{ position: 'relative' }}>
          <Brand size="lg" align="center" />
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
        </div>
      </div>
    );
  }

  // Authentication gate: first launch (or after a reset) creates an account; otherwise sign in.
  const account = hasAccount(settings);
  if (!account || !sessionOn) {
    return <LoginPortal key={account ? 'login' : 'create'} mode={account ? 'login' : 'create'} knownName={settings?.userName} knownEmail={settings?.email} onAuthenticated={() => setSessionOn(true)} />;
  }

  return (
    <div
      id="app-root-canvas"
<<<<<<< HEAD
      style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: 'var(--bg-primary)', backgroundImage: 'var(--bg-image, none)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', position: 'relative' }}
=======
      style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-primary)', position: 'relative' }}
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
    >
      {/* Application UI */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onSignOut={() => setSessionOn(false)} />
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', minWidth: 0, overflow: 'hidden', zIndex: 1 }}>
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
<<<<<<< HEAD
        />
        
        <main key={activeTab} className="nav-page-transition" style={{ flex: 1, overflowY: 'auto', scrollbarGutter: 'stable' }}>
          <Suspense fallback={<div role="status" className="subtitle" style={{ padding: '2rem' }}>Loading…</div>}>
=======
          onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
        />
        
        <main key={activeTab} className="nav-page-transition" style={{ flex: 1, overflowY: 'auto', scrollbarGutter: 'stable' }}>
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
          {activeTab === 'dashboard' && <DashboardView setActiveTab={setActiveTab} />}
          {activeTab === 'habits' && <HabitsView setActiveTab={setActiveTab} />}
          {activeTab === 'dolist' && <DoListView />}
          {activeTab === 'analytics' && <AnalyticsView />}
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'finance' && <FinanceView />}
          {activeTab === 'workspace' && <NotepadView />}
          {activeTab === 'insights' && <InsightsView setActiveTab={setActiveTab} />}
          {activeTab === 'settings' && <SettingsView />}
<<<<<<< HEAD
          </Suspense>
        </main>
      </div>

      <NotificationHost />
=======
        </main>
      </div>

      {/* Adaptive Contextual Sidebar Drawer */}
      <ContextualSidebarDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeTab={activeTab}
        selectedTaskId={selectedTaskId}
        selectedHabitId={selectedHabitId}
      />
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
    </div>
  );
};

export default App;




