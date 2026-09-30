import { INITIAL_TASKS } from '../utils/storage';
import { sound } from '../utils/audio';
import type { Task, ViewMode, Priority, FilterPriority, Subtask } from '../types/todo';

const DB_KEY = 'geist_tasks_db_v1';
const POMO_KEY = 'geist_tasks_pomo_stats';

export class TodoController {
  tasks: Task[] = [];
  currentView: ViewMode = 'list';
  filterPriority: FilterPriority = 'all';
  filterTag: string | null = null;
  searchQuery: string = '';
  sortBy: string = 'created-desc';
  
  // Pomodoro state
  pomoTimeLeft: number = 25 * 60;
  pomoIsRunning: boolean = false;
  pomoMode: 'work' | 'break' = 'work';
  pomoInterval: number | null = null;
  activeFocusTaskId: string | null = null;
  pomoCompletedToday: number = 0;

  constructor() {
    this.loadTasks();
    this.loadPomoStats();
    this.initEvents();
    this.updateLiveDate();
    this.render();
  }

  loadTasks() {
    try {
      const stored = localStorage.getItem(DB_KEY);
      if (stored) {
        this.tasks = JSON.parse(stored);
      } else {
        this.tasks = [...INITIAL_TASKS];
        this.saveTasks();
      }
    } catch {
      this.tasks = [...INITIAL_TASKS];
    }
  }

  saveTasks() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(this.tasks));
    } catch (err) {
      console.error('Save failed:', err);
    }
    this.render();
  }

  loadPomoStats() {
    try {
      const p = localStorage.getItem(POMO_KEY);
      if (p) {
        const data = JSON.parse(p);
        this.pomoCompletedToday = data.completedToday || 0;
      }
    } catch {}
  }

  savePomoStats() {
    localStorage.setItem(POMO_KEY, JSON.stringify({
      completedToday: this.pomoCompletedToday
    }));
  }

  updateLiveDate() {
    const el = document.getElementById('live-date-str');
    if (el) {
      const d = new Date();
      el.textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  }

  showToast(message: string) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'px-3.5 py-2 rounded-[6px] bg-[#171717] dark:bg-[#ededed] text-white dark:text-[#171717] text-xs font-medium shadow-lg border border-[#333333] dark:border-[#dddddd] transition-all transform translate-y-2 opacity-0 pointer-events-auto';
    toast.textContent = message;
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  }

  initEvents() {
    // Add Task Form Submission
    const addForm = document.getElementById('add-task-form') as HTMLFormElement;
    addForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAddTask();
    });

    // Toggle Options expand
    const expandBtn = document.getElementById('toggle-expand-form');
    const expandedOptions = document.getElementById('expanded-options');
    expandBtn?.addEventListener('click', () => {
      expandedOptions?.classList.toggle('hidden');
      expandBtn.textContent = expandedOptions?.classList.contains('hidden') ? 'Options ▾' : 'Hide ▴';
      sound.playTap();
    });

    // Quick date chips
    document.querySelectorAll('.quick-date-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const offset = parseInt((e.currentTarget as HTMLElement).dataset.offset || '0');
        const d = new Date();
        d.setDate(d.getDate() + offset);
        const dateInput = document.getElementById('task-input-date') as HTMLInputElement;
        if (dateInput) {
          dateInput.value = d.toISOString().split('T')[0];
        }
        sound.playTap();
      });
    });

    // View Tabs Switcher
    document.querySelectorAll('.view-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetView = (e.currentTarget as HTMLElement).dataset.view as ViewMode;
        this.setView(targetView);
      });
    });

    // Priority Filters
    document.querySelectorAll('.filter-p-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const p = (e.currentTarget as HTMLElement).dataset.filterP as FilterPriority;
        this.filterPriority = p;
        document.querySelectorAll('.filter-p-btn').forEach(b => {
          b.classList.remove('active-filter', 'bg-[#171717]', 'text-white', 'dark:bg-white', 'dark:text-[#171717]');
        });
        btn.classList.add('active-filter', 'bg-[#171717]', 'text-white', 'dark:bg-white', 'dark:text-[#171717]');
        sound.playTap();
        this.render();
      });
    });

    // Sort Change
    const sortSelect = document.getElementById('sort-select') as HTMLSelectElement;
    sortSelect?.addEventListener('change', () => {
      this.sortBy = sortSelect.value;
      this.render();
    });

    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    themeBtn?.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark) {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        localStorage.setItem('geist_theme', 'light');
      } else {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
        localStorage.setItem('geist_theme', 'dark');
      }
      sound.playTap();
    });

    // Sound toggle
    const soundBtn = document.getElementById('sound-toggle-btn');
    const soundOn = document.getElementById('sound-on-icon');
    const soundOff = document.getElementById('sound-off-icon');
    soundBtn?.addEventListener('click', () => {
      sound.enabled = !sound.enabled;
      if (sound.enabled) {
        soundOn?.classList.remove('hidden');
        soundOff?.classList.add('hidden');
        sound.playTap();
        this.showToast('Audio feedback enabled');
      } else {
        soundOn?.classList.add('hidden');
        soundOff?.classList.remove('hidden');
        this.showToast('Audio feedback disabled');
      }
    });

    // Batch actions menu dropdown toggle
    const batchBtn = document.getElementById('batch-menu-btn');
    const batchMenu = document.getElementById('batch-menu-dropdown');
    batchBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      batchMenu?.classList.toggle('hidden');
    });
    document.addEventListener('click', () => {
      batchMenu?.classList.add('hidden');
    });

    // Export JSON
    document.getElementById('action-export-json')?.addEventListener('click', () => this.exportJSON());
    document.getElementById('action-export-csv')?.addEventListener('click', () => this.exportCSV());
    document.getElementById('action-clear-completed')?.addEventListener('click', () => this.clearCompleted());
    document.getElementById('action-load-sample')?.addEventListener('click', () => this.loadSampleData());
    document.getElementById('footer-reset-btn')?.addEventListener('click', () => this.loadSampleData());

    // Import JSON file
    const importInput = document.getElementById('action-import-file') as HTMLInputElement;
    importInput?.addEventListener('change', (e) => this.handleImportJSON(e));

    // Shortcuts modal
    const shortcutsBtn = document.getElementById('shortcuts-btn');
    const shortcutsModal = document.getElementById('shortcuts-modal');
    const closeShortcuts = document.getElementById('close-shortcuts-modal');
    shortcutsBtn?.addEventListener('click', () => shortcutsModal?.classList.remove('hidden'));
    closeShortcuts?.addEventListener('click', () => shortcutsModal?.classList.add('hidden'));

    // Command palette
    const cmdBtn = document.getElementById('open-cmd-btn');
    const cmdModal = document.getElementById('cmd-palette-modal');
    const cmdInput = document.getElementById('cmd-input') as HTMLInputElement;
    cmdBtn?.addEventListener('click', () => this.openCommandPalette());

    cmdInput?.addEventListener('input', () => this.filterCommands(cmdInput.value));

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openCommandPalette();
        return;
      }

      // ESC to close any modal
      if (e.key === 'Escape') {
        cmdModal?.classList.add('hidden');
        shortcutsModal?.classList.add('hidden');
        document.getElementById('edit-task-modal')?.classList.add('hidden');
        return;
      }

      // Ignore single letter shortcuts when inside input/textarea
      const tag = (e.target as HTMLElement).tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        const titleInput = document.getElementById('task-input-title');
        titleInput?.focus();
      } else if (e.key === '?') {
        shortcutsModal?.classList.remove('hidden');
      } else if (e.key === 'f' || e.key === 'F') {
        this.setView('focus');
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const views: ViewMode[] = ['list', 'today', 'upcoming', 'matrix', 'kanban'];
        const idx = parseInt(e.key) - 1;
        if (views[idx]) this.setView(views[idx]);
      }
    });

    // Edit Task Form
    const editForm = document.getElementById('edit-task-form') as HTMLFormElement;
    editForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveEdit();
    });

    document.getElementById('close-edit-modal')?.addEventListener('click', () => {
      document.getElementById('edit-task-modal')?.classList.add('hidden');
    });
    document.getElementById('cancel-edit-modal')?.addEventListener('click', () => {
      document.getElementById('edit-task-modal')?.classList.add('hidden');
    });
    document.getElementById('modal-delete-btn')?.addEventListener('click', () => {
      const id = (document.getElementById('edit-task-id') as HTMLInputElement).value;
      if (id) {
        this.deleteTask(id);
        document.getElementById('edit-task-modal')?.classList.add('hidden');
      }
    });

    // Modal Add Subtask
    document.getElementById('modal-add-subtask-btn')?.addEventListener('click', () => {
      this.addEditModalSubtask();
    });

    // Pomodoro Controls
    document.getElementById('pomo-toggle-btn')?.addEventListener('click', () => this.togglePomodoro());
    document.getElementById('pomo-reset-btn')?.addEventListener('click', () => this.resetPomodoro());
    document.getElementById('pomo-mode-work')?.addEventListener('click', () => this.setPomoMode('work'));
    document.getElementById('pomo-mode-break')?.addEventListener('click', () => this.setPomoMode('break'));
    document.getElementById('nav-pomo-btn')?.addEventListener('click', () => this.setView('focus'));

    const focusSelect = document.getElementById('focus-task-select') as HTMLSelectElement;
    focusSelect?.addEventListener('change', () => {
      this.activeFocusTaskId = focusSelect.value || null;
      this.updateFocusTaskDisplay();
    });

    // Collapse completed section toggle
    const compToggle = document.getElementById('toggle-completed-section');
    const compList = document.getElementById('completed-tasks-list');
    const compArrow = document.getElementById('completed-arrow');
    compToggle?.addEventListener('click', () => {
      compList?.classList.toggle('hidden');
      if (compArrow) {
        compArrow.textContent = compList?.classList.contains('hidden') ? '▸' : '▾';
      }
    });
  }

  openCommandPalette() {
    const cmdModal = document.getElementById('cmd-palette-modal');
    const cmdInput = document.getElementById('cmd-input') as HTMLInputElement;
    cmdModal?.classList.remove('hidden');
    if (cmdInput) {
      cmdInput.value = '';
      cmdInput.focus();
      this.filterCommands('');
    }
  }

  filterCommands(q: string) {
    const results = document.getElementById('cmd-results');
    if (!results) return;
    const query = q.toLowerCase().trim();

    const defaultCmds = [
      { label: 'New Task (Focus input)', icon: '+', action: () => { (document.getElementById('task-input-title') as HTMLInputElement)?.focus(); } },
      { label: 'Switch to All Tasks', icon: '📋', action: () => this.setView('list') },
      { label: 'Switch to Today View', icon: '☀️', action: () => this.setView('today') },
      { label: 'Switch to Eisenhower Matrix', icon: '🧭', action: () => this.setView('matrix') },
      { label: 'Switch to Kanban Board', icon: '🗂️', action: () => this.setView('kanban') },
      { label: 'Switch to Focus / Pomodoro Mode', icon: '⏱️', action: () => this.setView('focus') },
      { label: 'Switch to Analytics', icon: '📊', action: () => this.setView('analytics') },
      { label: 'Export Database to JSON', icon: '💾', action: () => this.exportJSON() },
      { label: 'Clear Completed Tasks', icon: '🗑️', action: () => this.clearCompleted() },
      { label: 'Toggle Light / Dark Mode', icon: '🌓', action: () => (document.getElementById('theme-toggle-btn') as HTMLElement)?.click() }
    ];

    const matchingTasks = this.tasks
      .filter(t => t.title.toLowerCase().includes(query))
      .map(t => ({
        label: `Task: ${t.title}`,
        icon: t.status === 'completed' ? '✓' : '○',
        action: () => this.openEditModal(t.id)
      }));

    const all = [...defaultCmds.filter(c => c.label.toLowerCase().includes(query)), ...matchingTasks];

    results.innerHTML = all.map((c, i) => `
      <button class="cmd-item w-full flex items-center justify-between p-2 rounded-[6px] hover:bg-[#f2f2f2] dark:hover:bg-[#1c1c1c] text-left text-[#171717] dark:text-white transition-colors" data-index="${i}">
        <span class="flex items-center gap-2">
          <span class="w-5 text-center font-mono text-[#8f8f8f]">${c.icon}</span>
          <span>${c.label}</span>
        </span>
        <span class="text-[10px] font-mono text-[#8f8f8f]">Jump ↵</span>
      </button>
    `).join('');

    results.querySelectorAll('.cmd-item').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        all[idx].action();
        document.getElementById('cmd-palette-modal')?.classList.add('hidden');
        sound.playTap();
      });
    });
  }

  handleAddTask() {
    const titleInput = document.getElementById('task-input-title') as HTMLInputElement;
    const rawTitle = titleInput.value.trim();
    if (!rawTitle) return;

    let title = rawTitle;
    let priority: Priority = 'p3';
    let tags: string[] = [];
    let dueDate = (document.getElementById('task-input-date') as HTMLInputElement).value || '';

    const pMatch = title.match(/!(p[1-4])/i);
    if (pMatch) {
      priority = pMatch[1].toLowerCase() as Priority;
      title = title.replace(pMatch[0], '').trim();
    } else {
      priority = ((document.getElementById('task-input-priority') as HTMLSelectElement)?.value as Priority) || 'p3';
    }

    const tagMatches = title.match(/#(\w+)/g);
    if (tagMatches) {
      tags = tagMatches.map(t => t.replace('#', '').toLowerCase());
      tagMatches.forEach(tm => {
        title = title.replace(tm, '').trim();
      });
    }

    const explicitTags = (document.getElementById('task-input-tags') as HTMLInputElement)?.value;
    if (explicitTags) {
      const extra = explicitTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      tags = Array.from(new Set([...tags, ...extra]));
    }

    if (title.toLowerCase().includes('@today')) {
      dueDate = new Date().toISOString().split('T')[0];
      title = title.replace(/@today/gi, '').trim();
    } else if (title.toLowerCase().includes('@tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dueDate = tomorrow.toISOString().split('T')[0];
      title = title.replace(/@tomorrow/gi, '').trim();
    }

    const desc = (document.getElementById('task-input-desc') as HTMLTextAreaElement)?.value || '';
    const poms = parseInt((document.getElementById('task-input-poms') as HTMLInputElement)?.value || '1');

    const newTask: Task = {
      id: 'task-' + Date.now(),
      title: title || rawTitle,
      description: desc,
      priority,
      status: 'todo',
      dueDate: dueDate || undefined,
      tags: tags.length > 0 ? tags : ['general'],
      subtasks: [],
      estimatedPoms: poms,
      completedPoms: 0,
      isUrgent: priority === 'p1' || priority === 'p2',
      isImportant: priority === 'p1' || priority === 'p2' || priority === 'p3',
      createdAt: Date.now()
    };

    this.tasks.unshift(newTask);
    this.saveTasks();

    titleInput.value = '';
    (document.getElementById('task-input-desc') as HTMLTextAreaElement).value = '';
    (document.getElementById('task-input-tags') as HTMLInputElement).value = '';
    (document.getElementById('task-input-date') as HTMLInputElement).value = '';

    sound.playTap();
    this.showToast('Task added to queue');
  }

  toggleTaskStatus(id: string) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    if (task.status === 'completed') {
      task.status = 'todo';
      task.completedAt = undefined;
      sound.playTap();
    } else {
      task.status = 'completed';
      task.completedAt = Date.now();
      sound.playComplete();
    }
    this.saveTasks();
  }

  deleteTask(id: string) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.saveTasks();
    sound.playTap();
    this.showToast('Task deleted');
  }

  setView(view: ViewMode) {
    this.currentView = view;
    document.querySelectorAll('.view-tab-btn').forEach(btn => {
      const isCurrent = (btn as HTMLElement).dataset.view === view;
      if (isCurrent) {
        btn.className = 'view-tab-btn active-tab px-3.5 py-1.5 rounded-full border border-transparent bg-[#171717] text-white dark:bg-white dark:text-[#171717] transition-all whitespace-nowrap';
      } else {
        btn.className = 'view-tab-btn px-3.5 py-1.5 rounded-full border border-[#ebebeb] dark:border-[#222222] bg-white dark:bg-[#0a0a0a] hover:bg-[#f7f7f8] dark:hover:bg-[#141414] text-[#4d4d4d] dark:text-[#a1a1a1] transition-all whitespace-nowrap';
      }
    });

    document.getElementById('view-list-container')?.classList.toggle('hidden', view !== 'list' && view !== 'today' && view !== 'upcoming');
    document.getElementById('view-matrix-container')?.classList.toggle('hidden', view !== 'matrix');
    document.getElementById('view-kanban-container')?.classList.toggle('hidden', view !== 'kanban');
    document.getElementById('view-focus-container')?.classList.toggle('hidden', view !== 'focus');
    document.getElementById('view-analytics-container')?.classList.toggle('hidden', view !== 'analytics');

    sound.playTap();
    this.render();
  }

  getFilteredTasks(): Task[] {
    let list = [...this.tasks];

    const todayStr = new Date().toISOString().split('T')[0];
    if (this.currentView === 'today') {
      list = list.filter(t => t.dueDate === todayStr || (!t.dueDate && t.status !== 'completed'));
    } else if (this.currentView === 'upcoming') {
      list = list.filter(t => t.dueDate && t.dueDate > todayStr);
    }

    if (this.filterPriority !== 'all') {
      list = list.filter(t => t.priority === this.filterPriority);
    }

    if (this.filterTag) {
      list = list.filter(t => t.tags.includes(this.filterTag!));
    }

    list.sort((a, b) => {
      if (this.sortBy === 'created-desc') return b.createdAt - a.createdAt;
      if (this.sortBy === 'due-asc') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (this.sortBy === 'priority-asc') return a.priority.localeCompare(b.priority);
      if (this.sortBy === 'title-asc') return a.title.localeCompare(b.title);
      return 0;
    });

    return list;
  }

  render() {
    this.renderMetrics();
    this.renderTagsFilter();
    this.renderListView();
    this.renderMatrixView();
    this.renderKanbanView();
    this.renderFocusSelect();
    this.renderAnalytics();
  }

  renderMetrics() {
    const active = this.tasks.filter(t => t.status !== 'completed').length;
    const todayStr = new Date().toISOString().split('T')[0];
    const doneToday = this.tasks.filter(t => t.status === 'completed' && t.completedAt && new Date(t.completedAt).toISOString().split('T')[0] === todayStr).length;
    const total = this.tasks.length;
    const velocity = total > 0 ? Math.round((this.tasks.filter(t => t.status === 'completed').length / total) * 100) : 0;

    const activeEl = document.getElementById('metric-active-count');
    const doneEl = document.getElementById('metric-done-count');
    const velEl = document.getElementById('metric-velocity');
    const badgeAll = document.getElementById('badge-all');
    const badgeToday = document.getElementById('badge-today');

    if (activeEl) activeEl.textContent = active.toString();
    if (doneEl) doneEl.textContent = doneToday.toString();
    if (velEl) velEl.textContent = `${velocity}%`;
    if (badgeAll) badgeAll.textContent = active.toString();
    if (badgeToday) {
      const todayTasks = this.tasks.filter(t => t.dueDate === todayStr && t.status !== 'completed').length;
      badgeToday.textContent = todayTasks.toString();
    }
  }

  renderTagsFilter() {
    const container = document.getElementById('dynamic-tags-container');
    if (!container) return;
    
    const allTags = Array.from(new Set(this.tasks.flatMap(t => t.tags)));
    container.innerHTML = allTags.map(tag => `
      <button 
        class="tag-filter-pill px-2.5 py-1 rounded-[6px] text-xs font-mono transition-colors ${this.filterTag === tag ? 'bg-[#0070f3] text-white' : 'bg-white dark:bg-[#0a0a0a] border border-[#ebebeb] dark:border-[#222222] text-[#8f8f8f] hover:text-[#171717] dark:hover:text-white'}"
        data-tag="${tag}"
      >
        #${tag}
      </button>
    `).join('');

    container.querySelectorAll('.tag-filter-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tag = (e.currentTarget as HTMLElement).dataset.tag;
        this.filterTag = this.filterTag === tag ? null : tag || null;
        sound.playTap();
        this.render();
      });
    });
  }

  renderTaskCard(task: Task): string {
    const isDone = task.status === 'completed';
    const todayStr = new Date().toISOString().split('T')[0];
    const isOverdue = task.dueDate && task.dueDate < todayStr && !isDone;

    const pColorMap: Record<Priority, string> = {
      p1: 'bg-[#ee0000]/10 text-[#ee0000] border-[#ee0000]/30',
      p2: 'bg-[#f5a623]/10 text-[#f5a623] border-[#f5a623]/30',
      p3: 'bg-[#0070f3]/10 text-[#0070f3] border-[#0070f3]/30',
      p4: 'bg-[#8f8f8f]/10 text-[#8f8f8f] border-[#8f8f8f]/30'
    };

    const completedSubtasks = task.subtasks.filter(s => s.completed).length;
    const totalSubtasks = task.subtasks.length;

    return `
      <div 
        class="group rounded-[12px] bg-white dark:bg-[#0a0a0a] border border-[#ebebeb] dark:border-[#222222] hover:border-[#d4d4d4] dark:hover:border-[#383838] p-3 sm:p-4 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${isDone ? 'opacity-60 bg-[#fafafa]/50 dark:bg-[#080808]' : ''}"
        data-task-id="${task.id}"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3 flex-1 min-w-0">
            <button 
              type="button" 
              class="task-check-btn mt-0.5 w-4 h-4 rounded-[4px] border transition-colors flex items-center justify-center shrink-0 ${isDone ? 'bg-[#171717] dark:bg-white border-transparent text-white dark:text-[#171717]' : 'border-[#d4d4d4] dark:border-[#444444] hover:border-[#0070f3]'}"
              data-action="toggle-status"
              data-id="${task.id}"
              aria-label="Toggle completed"
            >
              ${isDone ? '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
            </button>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="task-title text-[14px] font-medium leading-snug cursor-pointer hover:text-[#0070f3] transition-colors ${isDone ? 'line-through text-[#8f8f8f]' : 'text-[#171717] dark:text-white'}" data-action="edit" data-id="${task.id}">
                  ${task.title}
                </span>
                
                <span class="px-1.5 py-0.2 rounded-[4px] text-[10px] font-mono font-medium border uppercase ${pColorMap[task.priority]}">
                  ${task.priority.toUpperCase()}
                </span>

                ${task.dueDate ? `
                  <span class="inline-flex items-center gap-1 text-[11px] font-mono ${isOverdue ? 'text-[#ee0000] font-semibold' : 'text-[#8f8f8f]'}">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                    ${isOverdue ? 'Overdue: ' : ''}${task.dueDate === todayStr ? 'Today' : task.dueDate}
                  </span>
                ` : ''}
              </div>

              ${task.description ? `
                <p class="mt-1 text-xs text-[#666666] dark:text-[#999999] line-clamp-2 leading-relaxed">
                  ${task.description}
                </p>
              ` : ''}

              <div class="mt-2.5 flex items-center gap-2 flex-wrap">
                ${task.tags.map(t => `
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#f2f2f2] dark:bg-[#1c1c1c] text-[#666666] dark:text-[#a1a1a1]">
                    #${t}
                  </span>
                `).join('')}

                ${totalSubtasks > 0 ? `
                  <button class="toggle-subtasks-inline inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-mono bg-[#f7f7f8] dark:bg-[#161616] border border-[#ebebeb] dark:border-[#222222] text-[#4d4d4d] dark:text-[#a1a1a1]" data-id="${task.id}">
                    <span>${completedSubtasks}/${totalSubtasks} steps</span>
                  </button>
                ` : ''}

                <span class="text-[11px] font-mono text-[#8f8f8f]">
                  ⏱️ ${task.completedPoms}/${task.estimatedPoms}
                </span>
              </div>

              ${totalSubtasks > 0 ? `
                <div id="subtasks-inline-${task.id}" class="hidden mt-2 pt-2 border-t border-[#f2f2f2] dark:border-[#1c1c1c] space-y-1.5">
                  ${task.subtasks.map(s => `
                    <div class="flex items-center gap-2 text-xs text-[#4d4d4d] dark:text-[#a1a1a1]">
                      <input type="checkbox" ${s.completed ? 'checked' : ''} class="subtask-inline-check rounded" data-task-id="${task.id}" data-sub-id="${s.id}" />
                      <span class="${s.completed ? 'line-through text-[#8f8f8f]' : ''}">${s.title}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>

          <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <button 
              type="button" 
              class="p-1 text-[#8f8f8f] hover:text-[#0070f3] rounded-[4px] hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a]" 
              title="Start Focus Mode on this task"
              data-action="focus-task"
              data-id="${task.id}"
            >
              ⏱️
            </button>
            <button 
              type="button" 
              class="p-1 text-[#8f8f8f] hover:text-[#171717] dark:hover:text-white rounded-[4px] hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a]" 
              title="Edit task"
              data-action="edit"
              data-id="${task.id}"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button 
              type="button" 
              class="p-1 text-[#8f8f8f] hover:text-[#ee0000] rounded-[4px] hover:bg-[#ee0000]/10" 
              title="Delete task"
              data-action="delete"
              data-id="${task.id}"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderListView() {
    const activeListEl = document.getElementById('active-tasks-list');
    const compListEl = document.getElementById('completed-tasks-list');
    const emptyEl = document.getElementById('active-empty-state');
    const activeCountEl = document.getElementById('active-queue-count');
    const compCountEl = document.getElementById('completed-queue-count');

    const all = this.getFilteredTasks();
    const active = all.filter(t => t.status !== 'completed');
    const completed = all.filter(t => t.status === 'completed');

    if (activeCountEl) activeCountEl.textContent = active.length.toString();
    if (compCountEl) compCountEl.textContent = completed.length.toString();

    if (activeListEl) {
      if (active.length === 0) {
        activeListEl.innerHTML = '';
        emptyEl?.classList.remove('hidden');
      } else {
        emptyEl?.classList.add('hidden');
        activeListEl.innerHTML = active.map(t => this.renderTaskCard(t)).join('');
      }
    }

    if (compListEl) {
      compListEl.innerHTML = completed.map(t => this.renderTaskCard(t)).join('');
    }

    this.bindCardEvents();
  }

  renderMatrixView() {
    const q1El = document.getElementById('matrix-q1-list');
    const q2El = document.getElementById('matrix-q2-list');
    const q3El = document.getElementById('matrix-q3-list');
    const q4El = document.getElementById('matrix-q4-list');

    const active = this.tasks.filter(t => t.status !== 'completed');
    const q1 = active.filter(t => (t.priority === 'p1') || (t.isUrgent && t.isImportant));
    const q2 = active.filter(t => (t.priority === 'p2' || (!t.isUrgent && t.isImportant)) && !q1.includes(t));
    const q3 = active.filter(t => (t.priority === 'p3' || (t.isUrgent && !t.isImportant)) && !q1.includes(t) && !q2.includes(t));
    const q4 = active.filter(t => !q1.includes(t) && !q2.includes(t) && !q3.includes(t));

    const setList = (el: HTMLElement | null, countId: string, items: Task[]) => {
      if (!el) return;
      const cEl = document.getElementById(countId);
      if (cEl) cEl.textContent = items.length.toString();
      el.innerHTML = items.length ? items.map(t => this.renderTaskCard(t)).join('') : '<p class="text-xs text-[#8f8f8f] italic py-4 text-center">No tasks in this quadrant</p>';
    };

    setList(q1El, 'matrix-q1-count', q1);
    setList(q2El, 'matrix-q2-count', q2);
    setList(q3El, 'matrix-q3-count', q3);
    setList(q4El, 'matrix-q4-count', q4);

    this.bindCardEvents();
  }

  renderKanbanView() {
    const cols: { key: Task['status']; id: string; countId: string }[] = [
      { key: 'inbox', id: 'kanban-col-inbox', countId: 'kanban-count-inbox' },
      { key: 'todo', id: 'kanban-col-todo', countId: 'kanban-count-todo' },
      { key: 'in_progress', id: 'kanban-col-in_progress', countId: 'kanban-count-in_progress' },
      { key: 'completed', id: 'kanban-col-completed', countId: 'kanban-count-completed' },
    ];

    cols.forEach(col => {
      const el = document.getElementById(col.id);
      const countEl = document.getElementById(col.countId);
      const items = this.tasks.filter(t => t.status === col.key);
      if (countEl) countEl.textContent = items.length.toString();
      if (el) {
        el.innerHTML = items.length ? items.map(t => this.renderTaskCard(t)).join('') : '<div class="text-xs text-[#8f8f8f] text-center py-6 border border-dashed border-[#ebebeb] dark:border-[#222222] rounded-[6px]">Empty</div>';
      }
    });

    this.bindCardEvents();
  }

  renderFocusSelect() {
    const select = document.getElementById('focus-task-select') as HTMLSelectElement;
    if (!select) return;
    const active = this.tasks.filter(t => t.status !== 'completed');
    select.innerHTML = '<option value="">-- No specific task (Free focus) --</option>' + 
      active.map(t => `<option value="${t.id}" ${this.activeFocusTaskId === t.id ? 'selected' : ''}>[${t.priority.toUpperCase()}] ${t.title}</option>`).join('');
  }

  renderAnalytics() {
    const total = this.tasks.length;
    const done = this.tasks.filter(t => t.status === 'completed').length;
    const pending = total - done;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;

    const rateEl = document.getElementById('stat-rate');
    const rateBar = document.getElementById('stat-rate-bar');
    const doneNum = document.getElementById('stat-done-num');
    const pendNum = document.getElementById('stat-pending-num');

    if (rateEl) rateEl.textContent = `${rate}%`;
    if (rateBar) rateBar.style.width = `${rate}%`;
    if (doneNum) doneNum.textContent = done.toString();
    if (pendNum) pendNum.textContent = pending.toString();

    const p1 = this.tasks.filter(t => t.priority === 'p1').length;
    const p2 = this.tasks.filter(t => t.priority === 'p2').length;
    const p3 = this.tasks.filter(t => t.priority === 'p3').length;
    const p4 = this.tasks.filter(t => t.priority === 'p4').length;

    const sp1 = document.getElementById('stat-p1-count');
    const sp2 = document.getElementById('stat-p2-count');
    const sp3 = document.getElementById('stat-p3-count');
    const sp4 = document.getElementById('stat-p4-count');

    if (sp1) sp1.textContent = p1.toString();
    if (sp2) sp2.textContent = p2.toString();
    if (sp3) sp3.textContent = p3.toString();
    if (sp4) sp4.textContent = p4.toString();

    const totalHours = ((this.pomoCompletedToday * 25) / 60).toFixed(1);
    const focusH = document.getElementById('stat-focus-hours');
    const sprintsT = document.getElementById('stat-sprints-total');
    if (focusH) focusH.textContent = `${totalHours}h`;
    if (sprintsT) sprintsT.textContent = this.pomoCompletedToday.toString();
  }

  bindCardEvents() {
    document.querySelectorAll('[data-action="toggle-status"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).dataset.id;
        if (id) this.toggleTaskStatus(id);
      });
    });

    document.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).dataset.id;
        if (id) this.deleteTask(id);
      });
    });

    document.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).dataset.id;
        if (id) this.openEditModal(id);
      });
    });

    document.querySelectorAll('[data-action="focus-task"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).dataset.id;
        if (id) {
          this.activeFocusTaskId = id;
          this.setView('focus');
          this.updateFocusTaskDisplay();
        }
      });
    });

    document.querySelectorAll('.toggle-subtasks-inline').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).dataset.id;
        const drop = document.getElementById(`subtasks-inline-${id}`);
        drop?.classList.toggle('hidden');
      });
    });

    document.querySelectorAll('.subtask-inline-check').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const taskId = target.dataset.taskId;
        const subId = target.dataset.subId;
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
          const sub = task.subtasks.find(s => s.id === subId);
          if (sub) {
            sub.completed = target.checked;
            this.saveTasks();
            sound.playTap();
          }
        }
      });
    });
  }

  openEditModal(id: string) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    const modal = document.getElementById('edit-task-modal');
    (document.getElementById('edit-task-id') as HTMLInputElement).value = task.id;
    (document.getElementById('edit-task-title') as HTMLInputElement).value = task.title;
    (document.getElementById('edit-task-desc') as HTMLTextAreaElement).value = task.description || '';
    (document.getElementById('edit-task-priority') as HTMLSelectElement).value = task.priority;
    (document.getElementById('edit-task-status') as HTMLSelectElement).value = task.status;
    (document.getElementById('edit-task-date') as HTMLInputElement).value = task.dueDate || '';
    (document.getElementById('edit-task-poms') as HTMLInputElement).value = (task.estimatedPoms || 1).toString();
    (document.getElementById('edit-task-tags') as HTMLInputElement).value = task.tags.join(', ');

    this.renderEditModalSubtasks(task.subtasks);
    modal?.classList.remove('hidden');
  }

  renderEditModalSubtasks(subtasks: Subtask[]) {
    const container = document.getElementById('modal-subtasks-list');
    if (!container) return;
    container.innerHTML = subtasks.map(s => `
      <div class="flex items-center gap-2" data-sub-row="${s.id}">
        <input type="checkbox" ${s.completed ? 'checked' : ''} class="modal-sub-check rounded" />
        <input type="text" value="${s.title}" class="modal-sub-title flex-1 bg-[#fafafa] dark:bg-[#121212] border border-[#ebebeb] dark:border-[#222222] rounded-[4px] px-2 py-1 text-xs text-[#171717] dark:text-white" />
        <button type="button" class="modal-sub-del-btn text-xs text-[#ee0000] hover:opacity-80 px-1">✕</button>
      </div>
    `).join('');

    container.querySelectorAll('.modal-sub-del-btn').forEach(b => {
      b.addEventListener('click', (e) => {
        (e.currentTarget as HTMLElement).closest('[data-sub-row]')?.remove();
      });
    });
  }

  addEditModalSubtask() {
    const container = document.getElementById('modal-subtasks-list');
    if (!container) return;
    const subId = 'sub-' + Date.now();
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2';
    div.setAttribute('data-sub-row', subId);
    div.innerHTML = `
      <input type="checkbox" class="modal-sub-check rounded" />
      <input type="text" placeholder="Checklist step..." class="modal-sub-title flex-1 bg-[#fafafa] dark:bg-[#121212] border border-[#ebebeb] dark:border-[#222222] rounded-[4px] px-2 py-1 text-xs text-[#171717] dark:text-white" />
      <button type="button" class="modal-sub-del-btn text-xs text-[#ee0000] hover:opacity-80 px-1">✕</button>
    `;
    container.appendChild(div);
    div.querySelector('.modal-sub-del-btn')?.addEventListener('click', () => div.remove());
    const input = div.querySelector('.modal-sub-title') as HTMLInputElement;
    input?.focus();
  }

  handleSaveEdit() {
    const id = (document.getElementById('edit-task-id') as HTMLInputElement).value;
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    task.title = (document.getElementById('edit-task-title') as HTMLInputElement).value;
    task.description = (document.getElementById('edit-task-desc') as HTMLTextAreaElement).value;
    task.priority = (document.getElementById('edit-task-priority') as HTMLSelectElement).value as Priority;
    task.status = (document.getElementById('edit-task-status') as HTMLSelectElement).value as Task['status'];
    task.dueDate = (document.getElementById('edit-task-date') as HTMLInputElement).value || undefined;
    task.estimatedPoms = parseInt((document.getElementById('edit-task-poms') as HTMLInputElement).value) || 1;
    
    const rawTags = (document.getElementById('edit-task-tags') as HTMLInputElement).value;
    task.tags = rawTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

    const subRows = document.querySelectorAll('#modal-subtasks-list [data-sub-row]');
    const newSubtasks: Subtask[] = [];
    subRows.forEach(row => {
      const check = row.querySelector('.modal-sub-check') as HTMLInputElement;
      const titleInput = row.querySelector('.modal-sub-title') as HTMLInputElement;
      if (titleInput && titleInput.value.trim()) {
        newSubtasks.push({
          id: row.getAttribute('data-sub-row') || 'sub-' + Math.random(),
          title: titleInput.value.trim(),
          completed: check?.checked || false
        });
      }
    });
    task.subtasks = newSubtasks;

    this.saveTasks();
    document.getElementById('edit-task-modal')?.classList.add('hidden');
    sound.playTap();
    this.showToast('Task updated');
  }

  togglePomodoro() {
    if (this.pomoIsRunning) {
      this.pausePomodoro();
    } else {
      this.startPomodoro();
    }
  }

  startPomodoro() {
    this.pomoIsRunning = true;
    const btn = document.getElementById('pomo-toggle-btn');
    if (btn) btn.textContent = 'Pause';

    if (this.pomoInterval) clearInterval(this.pomoInterval);
    this.pomoInterval = window.setInterval(() => {
      if (this.pomoTimeLeft > 0) {
        this.pomoTimeLeft--;
        this.updatePomoDisplays();
      } else {
        this.completePomoSprint();
      }
    }, 1000);
    sound.playTap();
  }

  pausePomodoro() {
    this.pomoIsRunning = false;
    const btn = document.getElementById('pomo-toggle-btn');
    if (btn) btn.textContent = 'Resume Sprint';
    if (this.pomoInterval) clearInterval(this.pomoInterval);
  }

  resetPomodoro() {
    this.pausePomodoro();
    this.pomoTimeLeft = (this.pomoMode === 'work' ? 25 : 5) * 60;
    this.updatePomoDisplays();
    const btn = document.getElementById('pomo-toggle-btn');
    if (btn) btn.textContent = 'Start Sprint';
    sound.playTap();
  }

  setPomoMode(mode: 'work' | 'break') {
    this.pomoMode = mode;
    const workBtn = document.getElementById('pomo-mode-work');
    const breakBtn = document.getElementById('pomo-mode-break');
    if (mode === 'work') {
      workBtn?.setAttribute('class', 'px-3 py-1 rounded-full text-xs font-medium bg-[#171717] text-white dark:bg-white dark:text-[#171717]');
      breakBtn?.setAttribute('class', 'px-3 py-1 rounded-full text-xs font-medium text-[#8f8f8f] hover:bg-[#f2f2f2] dark:hover:bg-[#1c1c1c]');
    } else {
      breakBtn?.setAttribute('class', 'px-3 py-1 rounded-full text-xs font-medium bg-[#171717] text-white dark:bg-white dark:text-[#171717]');
      workBtn?.setAttribute('class', 'px-3 py-1 rounded-full text-xs font-medium text-[#8f8f8f] hover:bg-[#f2f2f2] dark:hover:bg-[#1c1c1c]');
    }
    this.resetPomodoro();
  }

  completePomoSprint() {
    this.pausePomodoro();
    sound.playPomoBell();

    if (this.pomoMode === 'work') {
      this.pomoCompletedToday++;
      this.savePomoStats();
      if (this.activeFocusTaskId) {
        const task = this.tasks.find(t => t.id === this.activeFocusTaskId);
        if (task) {
          task.completedPoms = (task.completedPoms || 0) + 1;
          this.saveTasks();
        }
      }
      this.showToast('Sprint complete! Time for a well-earned break.');
      this.setPomoMode('break');
    } else {
      this.showToast('Break finished! Ready for the next sprint?');
      this.setPomoMode('work');
    }
  }

  updatePomoDisplays() {
    const mins = Math.floor(this.pomoTimeLeft / 60);
    const secs = this.pomoTimeLeft % 60;
    const str = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    const navPomo = document.getElementById('nav-pomo-time');
    const mainPomo = document.getElementById('pomo-display-time');
    if (navPomo) navPomo.textContent = str;
    if (mainPomo) mainPomo.textContent = str;

    const sessionsEl = document.getElementById('pomo-completed-sessions');
    const focusMinsEl = document.getElementById('pomo-focused-mins');
    if (sessionsEl) sessionsEl.textContent = this.pomoCompletedToday.toString();
    if (focusMinsEl) focusMinsEl.textContent = (this.pomoCompletedToday * 25).toString();
  }

  updateFocusTaskDisplay() {
    const display = document.getElementById('focus-task-title-display');
    if (!display) return;
    if (this.activeFocusTaskId) {
      const task = this.tasks.find(t => t.id === this.activeFocusTaskId);
      if (task) {
        display.textContent = `Target: "${task.title}" (${task.completedPoms}/${task.estimatedPoms} pomodoros done)`;
        return;
      }
    }
    display.textContent = 'Select a task to anchor this sprint session';
  }

  exportJSON() {
    const blob = new Blob([JSON.stringify(this.tasks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geist-tasks-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Exported database as JSON');
  }

  exportCSV() {
    const headers = ['id', 'title', 'priority', 'status', 'dueDate', 'tags', 'completedPoms', 'estimatedPoms'];
    const rows = this.tasks.map(t => [
      t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      t.priority,
      t.status,
      t.dueDate || '',
      `"${t.tags.join(';')}"`,
      t.completedPoms || 0,
      t.estimatedPoms || 1
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geist-tasks-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Exported tasks as CSV');
  }

  handleImportJSON(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          this.tasks = data;
          this.saveTasks();
          this.showToast('Successfully restored tasks database');
        }
      } catch {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }

  clearCompleted() {
    const count = this.tasks.filter(t => t.status === 'completed').length;
    if (!count) {
      this.showToast('No completed tasks to clear');
      return;
    }
    this.tasks = this.tasks.filter(t => t.status !== 'completed');
    this.saveTasks();
    sound.playTap();
    this.showToast(`Cleared ${count} completed tasks`);
  }

  loadSampleData() {
    this.tasks = [...INITIAL_TASKS];
    this.saveTasks();
    sound.playTap();
    this.showToast('Loaded sample engineering roadmap');
  }
}
