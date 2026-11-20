import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Task } from '../db/schema';
import { DoItemList } from '../dolist/DoItemList';
import { X, CheckSquare, Plus, Trash2, CheckCircle2, Sparkles, Edit3, Calendar, Flame } from 'lucide-react';

interface TaskContextualDrawerProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onEditTask: (task: Task) => void;
}

export const TaskContextualDrawer: React.FC<TaskContextualDrawerProps> = ({
  task,
  isOpen,
  onClose,
  onEditTask,
}) => {
  const [showFullCompletionCelebration, setShowFullCompletionCelebration] = useState(false);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Live Do-List of the selected task (steps are edited by <DoItemList/>)
  const steps = useLiveQuery(
    async () => {
      if (!task?.id) return [];
      return await db.doItems.where('taskId').equals(task.id).sortBy('order');
    },
    [task?.id]
  ) || [];

  const completedSteps = steps.filter((s) => s.completed).length;
  const totalSteps = steps.length;
  const completionPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const isFullyCompleted = totalSteps > 0 && completedSteps === totalSteps;

  // Celebrate when the last open step gets checked (not when the drawer merely opens on a finished task)
  const wasFullyCompleted = React.useRef(isFullyCompleted);
  useEffect(() => {
    if (isFullyCompleted && !wasFullyCompleted.current) {
      setShowFullCompletionCelebration(true);
      const t = setTimeout(() => setShowFullCompletionCelebration(false), 2500);
      wasFullyCompleted.current = true;
      return () => clearTimeout(t);
    }
    wasFullyCompleted.current = isFullyCompleted;
    return undefined;
  }, [isFullyCompleted]);
  useEffect(() => {
    wasFullyCompleted.current = isFullyCompleted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  if (!isOpen || !task) return null;

  return (
    <>
      {/* Scrim Overlay */}
      <div className="drawer-scrim" onClick={onClose} />

      {/* Contextual Sidebar Drawer (Right Panel) */}
      <aside className={`contextual-drawer-right ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-sunken)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckSquare size={20} style={{ color: 'var(--accent-secondary)' }} />
            <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>Task Specifications</h3>
          </div>
          <button className="btn btn-secondary btn-icon btn-xs" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Drawer Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Main Objective Header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, textDecoration: task.status === 'completed' ? 'line-through' : 'none' }}>
                {task.title}
              </h2>
              <span
                style={{
                  fontSize: '0.725rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.55rem',
                  borderRadius: 'var(--radius-sm)',
                  background: task.priority === 'critical' ? 'var(--danger-bg)' : 'var(--success-bg)',
                  color: task.priority === 'critical' ? 'var(--danger)' : 'var(--accent-secondary)',
                  border: `1px solid ${task.priority === 'critical' ? 'var(--danger)' : 'var(--border-color)'}`,
                  textTransform: 'uppercase',
                }}
              >
                {task.priority}
              </span>
            </div>

            {task.description && (
              <p className="subtitle" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {task.description}
              </p>
            )}

            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Calendar size={13} /> Due: {task.dueDate || 'No due date'}
              </span>
              <span>Frequency: {task.frequency || 'Daily'}</span>
            </div>
          </div>

          {/* Full Completion Celebration Banner */}
          {(isFullyCompleted || showFullCompletionCelebration || task.status === 'completed') && (
            <div
              className="splash-reveal"
              style={{
                padding: '0.85rem 1rem',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-primary)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                color: 'var(--text-primary)',
              }}
            >
              <Flame size={24} style={{ color: 'var(--warning)' }} />
              <div>
                <strong style={{ fontSize: '0.9rem', display: 'block', color: 'var(--text-primary)' }}>Primary Objective Satisfied! 🎉</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Every Do-List step is done — task marked as completed.
                </span>
              </div>
            </div>
          )}

          {/* Incremental Subtasks Progress Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', background: 'var(--surface-sunken)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '0.9rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
                <CheckSquare size={16} style={{ color: 'var(--accent-secondary)' }} /> Do-List Progress
              </h4>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isFullyCompleted ? 'var(--accent-primary)' : 'var(--accent-secondary)' }}>
                {completedSteps} / {totalSteps} ({completionPct}%)
              </span>
            </div>

            {/* Subtask Progress Track */}
            <div className="progress-bar-track" style={{ height: '8px' }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${completionPct}%`,
                  background: isFullyCompleted ? 'var(--accent-primary)' : 'var(--accent-secondary)',
                }}
              />
            </div>

            {/* Do-List steps */}
            <DoItemList taskId={task.id} hideHeader placeholder="Add a step…" />
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            background: 'var(--surface-sunken)',
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={() => {
              onEditTask(task);
              onClose();
            }}
          >
            <Edit3 size={14} /> Edit Task Specification
          </button>

          <button className="btn btn-primary" onClick={onClose}>
            Close Drawer
          </button>
        </div>
      </aside>
    </>
  );
};
