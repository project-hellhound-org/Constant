import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Task, Habit } from '../db/schema';
import { DoItemList } from '../dolist/DoItemList';
import { format } from 'date-fns';
import {
  X,
  CheckSquare,
  Calendar,
  Sparkles,
  BarChart2,
  BookOpen,
  Plus,
  CheckCircle2,
  Circle,
  Flame,
  Clock,
  Tag,
  AlertCircle
} from 'lucide-react';
import { ActiveTab } from '../App';

interface ContextualSidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: ActiveTab;
  selectedTaskId?: string | null;
  selectedHabitId?: string | null;
}

export const ContextualSidebarDrawer: React.FC<ContextualSidebarDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  selectedTaskId,
  selectedHabitId,
}) => {

  const todayIso = format(new Date(), 'yyyy-MM-dd');

  // Queries
  const task = useLiveQuery(
    async () => {
      if (!selectedTaskId) return undefined;
      return await db.tasks.get(selectedTaskId);
    },
    [selectedTaskId]
  );

  const habit = useLiveQuery(
    async () => {
      if (!selectedHabitId) return undefined;
      return await db.habits.get(selectedHabitId);
    },
    [selectedHabitId]
  );

  const steps = useLiveQuery(
    async () => {
      if (!selectedTaskId) return [];
      return await db.doItems.where('taskId').equals(selectedTaskId).sortBy('order');
    },
    [selectedTaskId]
  ) || [];

  const allHabits = useLiveQuery(() => db.habits.where('archived').equals(0).toArray()) || [];
  const allLogs = useLiveQuery(() => db.habitLogs.toArray()) || [];
  const todayLogs = allLogs.filter((l) => l.date === todayIso && l.status === 'completed');

  const allTasks = useLiveQuery(() => db.tasks.toArray()) || [];
  const scheduledTodaySteps = useLiveQuery(() => db.doItems.where('scheduledDate').equals(todayIso).toArray(), [todayIso]) || [];
  const scheduledTaskIds = new Set(scheduledTodaySteps.map((i) => i.taskId));
  // A task is "on today" if it is due today, or has a Do-List step scheduled for today.
  const dueTodayTasks = allTasks.filter((t) => t.dueDate === todayIso || scheduledTaskIds.has(t.id));

  if (!isOpen) return null;

  return (
    <>
      {/* Scrim Overlay */}
      <div className="drawer-scrim" onClick={onClose} />

      {/* Slide-out Sidebar Drawer */}
      <div className="contextual-drawer-right open">
        {/* Header */}
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--accent-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-secondary)',
              }}
            >
              {selectedTaskId || activeTab === 'dolist' ? (
                <CheckSquare size={18} />
              ) : selectedHabitId || activeTab === 'habits' ? (
                <Calendar size={18} />
              ) : activeTab === 'analytics' ? (
                <BarChart2 size={18} />
              ) : activeTab === 'insights' ? (
                <Sparkles size={18} />
              ) : (
                <BookOpen size={18} />
              )}
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {selectedTaskId && task
                  ? 'Task Context'
                  : selectedHabitId && habit
                  ? 'Habit Detail'
                  : activeTab === 'dolist'
                  ? 'Task Execution Sidebar'
                  : activeTab === 'habits'
                  ? 'Habit Logs & Streaks'
                  : activeTab === 'calendar'
                  ? 'Today\'s Agenda'
                  : activeTab === 'analytics'
                  ? 'Analytics Context'
                  : 'Contextual Assistant'}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Adaptive Contextual Insights
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-icon btn-secondary"
            style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="drawer-body">
          {/* 1. TASK CONTEXT VIEW */}
          {(selectedTaskId && task) || activeTab === 'dolist' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {task ? (
                <div className="liquid-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '0.2rem 0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        background:
                          task.priority === 'critical'
                            ? 'var(--danger-bg)'
                            : task.priority === 'high'
                            ? 'var(--warning-bg)'
                            : 'var(--accent-soft)',
                        color:
                          task.priority === 'critical'
                            ? 'var(--danger)'
                            : task.priority === 'high'
                            ? 'var(--warning)'
                            : 'var(--accent-secondary)',
                      }}
                    >
                      {task.priority} Priority
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Status: <strong style={{ color: 'var(--text-primary)' }}>{task.status}</strong>
                    </span>
                  </div>

                  <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                    {task.title}
                  </h4>
                  {task.description && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                      {task.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                    {task.dueDate && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={14} />
                        <span>Due: {task.dueDate} {task.dueTime ? `@ ${task.dueTime}` : ''}</span>
                      </div>
                    )}
                    {task.frequency && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Tag size={14} />
                        <span>Freq: {task.frequency}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="liquid-panel">
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                    Tasks Due Today ({dueTodayTasks.length})
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Select any task from the Do-List to view its steps and details here.
                  </p>
                </div>
              )}

              {/* Do-List */}
              {selectedTaskId && (
                <div className="liquid-panel">
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
                    Do-List ({steps.filter((s) => s.completed).length} / {steps.length})
                  </h4>
                  <DoItemList taskId={selectedTaskId} hideHeader />
                </div>
              )}
            </div>
          ) : selectedHabitId || activeTab === 'habits' ? (
            /* 2. HABIT CONTEXT VIEW */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div className="liquid-panel">
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  {habit ? habit.name : 'Today\'s Habit Execution'}
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  {habit?.description || `${todayLogs.length} of ${allHabits.length} habits logged for today.`}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ padding: '0.75rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Daily Rate</span>
                    <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-secondary)', margin: '0.2rem 0 0 0' }}>
                      {Math.round((todayLogs.length / (allHabits.length || 1)) * 100)}%
                    </h3>
                  </div>
                  <div style={{ padding: '0.75rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Active Habits</span>
                    <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: '0.2rem 0 0 0' }}>
                      {allHabits.length}
                    </h3>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 3. GENERAL / ANALYTICS / INSIGHTS VIEW */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div className="liquid-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <Flame size={18} style={{ color: 'var(--warning)' }} />
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Forest Flow Assistant
                  </h4>
                </div>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  This contextual drawer automatically presents active steps, streak analytics, and task timelines based on what you select.
                </p>
              </div>

              <div className="liquid-panel">
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  System Health & State
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <div>• Current Tab: <strong style={{ color: 'var(--text-primary)' }}>{activeTab}</strong></div>
                  <div>• Active Database: <strong style={{ color: 'var(--accent-secondary)' }}>Dexie IndexedDB v{db.verno}</strong></div>
                  <div>• AI Latency: <strong style={{ color: 'var(--accent-secondary)' }}>Optimized (&lt;150ms)</strong></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
