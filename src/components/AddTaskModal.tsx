import React, { useState, useEffect } from 'react';
import { db, Task, DoItem } from '../db/schema';
import { X, Plus, Calendar, CheckSquare, Trash2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
}

export const AddTaskModal: React.FC<AddTaskModalProps> = ({ isOpen, onClose, taskToEdit }) => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [frequency, setFrequency] = useState<'once_a_week' | 'daily' | 'custom'>('daily');
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]); // 0=Sun..6=Sat

  // Subtasks State inside Creation/Edit Panel
  // Do-List steps drafted inside the Creation/Edit panel (saved with the task)
  const [draftSubtasks, setDraftSubtasks] = useState<DoItem[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newStepDate, setNewStepDate] = useState('');
  const [newStepTime, setNewStepTime] = useState('');
  const [submitBtnState, setSubmitBtnState] = useState<'idle' | 'creating' | 'created'>('idle');

  const daysOfWeek = [
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
    { label: 'Sun', value: 0 },
  ];

  useEffect(() => {
    let isMounted = true;
    const loadTaskData = async () => {
      if (taskToEdit) {
        setTitle(taskToEdit.title || '');
        setDescription(taskToEdit.description || '');
        setPriority(taskToEdit.priority || 'medium');
        setCategory(taskToEdit.category || '');
        setDueDate(taskToEdit.dueDate || '');
        setTagsText((taskToEdit.tags || []).join(', '));
        setFrequency(taskToEdit.frequency || 'daily');
        setCustomDays(taskToEdit.customDays || [1, 2, 3, 4, 5]);

        // Fetch existing subtasks from IndexedDB
        try {
          const subs = await db.doItems.where('taskId').equals(taskToEdit.id).sortBy('order');
          if (isMounted) setDraftSubtasks(subs);
        } catch (e) {
          if (isMounted) setDraftSubtasks([]);
        }
      } else {
        setTitle('');
        setDescription('');
        setPriority('medium');
        setCategory('');
        setDueDate('');
        setTagsText('');
        setFrequency('daily');
        setCustomDays([1, 2, 3, 4, 5]);
        setDraftSubtasks([]);
      }
    };

    if (isOpen) {
      loadTaskData();
    }
    return () => { isMounted = false; };
  }, [taskToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const now = new Date().toISOString();
    setDraftSubtasks((prev) => [
      ...prev,
      {
        id: `do-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        taskId: taskToEdit?.id ?? '',
        title: newSubtaskTitle.trim(),
        completed: false,
        completedAt: null,
        scheduledDate: newStepDate || undefined,
        scheduledTime: newStepDate ? newStepTime || undefined : undefined,
        order: prev.length,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    setNewSubtaskTitle('');
    setNewStepDate('');
    setNewStepTime('');
  };

  const handleToggleDraftSubtask = (id: string) => {
    setDraftSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s))
    );
  };

  const handleRemoveDraftSubtask = (id: string) => {
    setDraftSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleDay = (dayVal: number) => {
    if (customDays.includes(dayVal)) {
      if (customDays.length > 1) {
        setCustomDays(customDays.filter((d) => d !== dayVal));
      }
    } else {
      setCustomDays([...customDays, dayVal].sort());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitBtnState('creating');

    // Auto completion check: If Do-List steps exist and all are checked, the task completes.
    const allSubtasksDone = draftSubtasks.length > 0 && draftSubtasks.every((s) => s.completed);
    const targetStatus = allSubtasksDone ? 'completed' : taskToEdit?.status || 'planned';
    const completedAtIso = allSubtasksDone ? new Date().toISOString() : taskToEdit?.completedAt || null;

    const taskId = taskToEdit ? taskToEdit.id : `task-${Date.now()}`;

    if (taskToEdit) {
      await db.tasks.update(taskId, {
        title: title.trim(),
        description: description.trim(),
        status: targetStatus,
        priority,
        category: category.trim() || undefined,
        dueDate: dueDate || undefined,
        tags: tagsText.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
        frequency,
        customDays: frequency === 'custom' ? customDays : undefined,
        completedAt: completedAtIso,
        updatedAt: new Date().toISOString(),
      });

      // Replace this task's Do-List with the edited draft
      await db.doItems.where('taskId').equals(taskId).delete();
    } else {
      await db.tasks.add({
        id: taskId,
        title: title.trim(),
        description: description.trim(),
        status: targetStatus,
        priority,
        category: category.trim() || undefined,
        dueDate: dueDate || undefined,
        tags: tagsText.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
        frequency,
        customDays: frequency === 'custom' ? customDays : undefined,
        completedAt: completedAtIso,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Insert the Do-List (preserves ids, completion times, and any scheduling)
    if (draftSubtasks.length > 0) {
      const now = new Date().toISOString();
      const entities: DoItem[] = draftSubtasks.map((s, idx) => ({
        ...s,
        taskId,
        order: idx,
        completedAt: s.completed ? s.completedAt || now : null,
        updatedAt: now,
      }));
      await db.doItems.bulkAdd(entities);
    }

    setSubmitBtnState('created');
    setTimeout(() => {
      setSubmitBtnState('idle');
      onClose();
    }, 400);
  };

  const completedSubtasksCount = draftSubtasks.filter((s) => s.completed).length;
  const isAllDraftSubtasksCompleted = draftSubtasks.length > 0 && completedSubtasksCount === draftSubtasks.length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay)',
        
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
      onClick={onClose}
    >
      <div
        className="liquid-panel"
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          padding: '1.75rem',
          boxShadow: '0 20px 50px var(--overlay)',
          border: '1px solid var(--border-glow)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              <Calendar size={20} style={{ color: 'var(--accent-secondary)' }} /> {taskToEdit ? 'Edit Task Specification' : 'Create New Task'}
            </h3>
            <p className="subtitle" style={{ fontSize: '0.825rem', margin: '0.2rem 0 0 0' }}>Configure priority level, subtasks, and execution scheduling.</p>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* One cohesive panel: details, steps, scheduling */}
          <div className="task-panel">
          <div className="task-panel-section">
            <h4 className="task-panel-title">
              Details
            </h4>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Task Title *</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="e.g. System Architecture Security Review..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Detailed Rationale & Scope</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Task objectives, scope, or delivery specifications..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Section 2: Subtask Breakdown */}
          <div className="task-panel-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 className="task-panel-title">
                Do-List Steps ({completedSubtasksCount}/{draftSubtasks.length})
              </h4>
              {isAllDraftSubtasksCompleted && (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle2 size={14} /> Full Completion Satisfied
                </span>
              )}
            </div>

            {draftSubtasks.length > 0 && (
              <div className="progress-bar-track" style={{ height: '7px', marginBottom: '0.2rem' }}>
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.round((completedSubtasksCount / draftSubtasks.length) * 100)}%`,
                    background: isAllDraftSubtasksCompleted ? 'var(--accent-primary)' : 'var(--accent-secondary)',
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '160px', overflowY: 'auto' }}>
              {draftSubtasks.map((st) => (
                <div key={st.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.75rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', flex: 1, textDecoration: st.completed ? 'line-through' : 'none', color: st.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={st.completed}
                      onChange={() => handleToggleDraftSubtask(st.id)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span>{st.title}</span>
                    {st.scheduledDate && <span style={{ fontSize: '0.7rem', color: 'var(--accent-secondary)', marginLeft: '0.4rem' }}>{st.scheduledDate}{st.scheduledTime ? ` · ${st.scheduledTime}` : ''}</span>}
                  </label>
                  <button type="button" className="btn btn-danger btn-icon btn-xs" onClick={() => handleRemoveDraftSubtask(st.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            <div className="task-step-add">
              <input
                type="text"
                className="form-input"
                style={{ gridColumn: '1 / -1', fontSize: '0.85rem' }}
                placeholder="Add a step…"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
              />
              <input type="date" aria-label="Step date (optional)" className="form-input" style={{ fontSize: '0.8rem', minWidth: 0 }} value={newStepDate} onChange={(e) => setNewStepDate(e.target.value)} />
              <input type="time" aria-label="Step time (optional)" className="form-input" style={{ fontSize: '0.8rem', minWidth: 0 }} disabled={!newStepDate} value={newStepTime} onChange={(e) => setNewStepTime(e.target.value)} />
              <button type="button" className="btn btn-secondary btn-xs" onClick={handleAddSubtask} style={{ height: 40, justifyContent: 'center' }}>
                <Plus size={14} /> Add Step
              </button>
            </div>
          </div>

          {/* Section 3: Priority & Schedule */}
          <div className="task-panel-section">
            <h4 className="task-panel-title">
              Priority & Frequency
            </h4>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Priority Level</label>
              <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="critical">Critical Priority</option>
              </select>
              <span className="subtitle" style={{ fontSize: '0.775rem', marginTop: '0.4rem', display: 'block' }}>
                Tasks have no start date. To schedule work, give individual Do-List steps a date and time.
              </span>
            </div>

            <div className="task-field-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="task-category">Category</label>
                <input id="task-category" className="form-input" list="task-category-options" maxLength={32} placeholder="Learning, Work, Health, Personal" value={category} onChange={(e) => setCategory(e.target.value)} />
                <datalist id="task-category-options">{['Learning', 'Work', 'Health', 'Personal'].map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="task-due">Due date</label>
                <input id="task-due" type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="task-tags">Tags</label>
                <input id="task-tags" className="form-input" placeholder="study, cybersecurity" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Execution Frequency</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.6rem' }}>
                <button
                  type="button"
                  className={`btn ${frequency === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ height: 40, justifyContent: 'center', padding: '0 0.5rem' }}
                  onClick={() => setFrequency('daily')}
                >
                  Daily
                </button>
                <button
                  type="button"
                  className={`btn ${frequency === 'once_a_week' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ height: 40, justifyContent: 'center', padding: '0 0.5rem' }}
                  onClick={() => setFrequency('once_a_week')}
                >
                  Once a Week
                </button>
                <button
                  type="button"
                  className={`btn ${frequency === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ height: 40, justifyContent: 'center', padding: '0 0.5rem' }}
                  onClick={() => setFrequency('custom')}
                >
                  Custom Days
                </button>
              </div>

              {frequency === 'custom' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.4rem', marginTop: '0.6rem' }}>
                  {daysOfWeek.map((d) => {
                    const selected = customDays.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        style={{
                          flex: 1,
                          padding: '0.5rem 0',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-color)',
                          background: selected ? 'var(--accent-primary)' : 'var(--bg-primary)',
                          color: selected ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          transition: 'all 150ms ease',
                        }}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '0.65rem 1.25rem' }}>
              Cancel
            </button>
            <button
              type="submit"
              className={`btn btn-primary btn-morph ${submitBtnState}`}
              disabled={submitBtnState !== 'idle'}
              style={{ padding: '0.65rem 1.5rem' }}
            >
              {submitBtnState === 'creating' ? (
                'Creating...'
              ) : submitBtnState === 'created' ? (
                '✓ Created'
              ) : (
                <>
                  <Plus size={16} /> {taskToEdit ? 'Save Task Changes' : 'Add Task'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
