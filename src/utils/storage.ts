import type { Task } from '../types/todo';

const STORAGE_KEY = 'geist_tasks_db_v1';
const SETTINGS_KEY = 'geist_tasks_settings_v1';

export const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'Deploy edge middleware for geo-routing and caching',
    description: 'Configure distributed Vercel Edge functions with stale-while-revalidate headers for sub-50ms latency globally.',
    priority: 'p1',
    status: 'in_progress',
    dueDate: new Date().toISOString().split('T')[0],
    tags: ['infra', 'vercel', 'performance'],
    subtasks: [
      { id: 'sub-1', title: 'Write unit tests for latency benchmarking', completed: true },
      { id: 'sub-2', title: 'Verify TLS 1.3 certificate rotation', completed: true },
      { id: 'sub-3', title: 'Deploy staging preview environment', completed: false }
    ],
    estimatedPoms: 3,
    completedPoms: 2,
    isUrgent: true,
    isImportant: true,
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'task-2',
    title: 'Refactor UI design tokens to Geist design system',
    description: 'Implement hairline 1px borders, near-white canvas (#fafafa), Geist Sans typography, and dual button architecture.',
    priority: 'p1',
    status: 'todo',
    dueDate: new Date().toISOString().split('T')[0],
    tags: ['design', 'frontend'],
    subtasks: [
      { id: 'sub-4', title: 'Audit contrast ratios for WCAG-AAA compliance', completed: false },
      { id: 'sub-5', title: 'Configure Geist Mono eyebrows', completed: false }
    ],
    estimatedPoms: 4,
    completedPoms: 0,
    isUrgent: true,
    isImportant: true,
    createdAt: Date.now() - 86400000 * 1,
  },
  {
    id: 'task-3',
    title: 'Integrate Web Audio API micro-haptics on task check',
    description: 'Synthesize soft click frequency (880Hz) and rewarding melodic chord upon completing tasks.',
    priority: 'p2',
    status: 'todo',
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    tags: ['frontend', 'ux'],
    subtasks: [],
    estimatedPoms: 2,
    completedPoms: 0,
    isUrgent: false,
    isImportant: true,
    createdAt: Date.now() - 3600000 * 5,
  },
  {
    id: 'task-4',
    title: 'Optimize Core Web Vitals to 100/100 Lighthouse score',
    description: 'Eliminate render-blocking stylesheets, defer non-critical JS chunks, and optimize SVG assets.',
    priority: 'p3',
    status: 'todo',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    tags: ['performance', 'seo'],
    subtasks: [
      { id: 'sub-6', title: 'Self-host Geist font files', completed: true },
      { id: 'sub-7', title: 'Minify SVG path payloads', completed: false }
    ],
    estimatedPoms: 3,
    completedPoms: 1,
    isUrgent: false,
    isImportant: false,
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'task-5',
    title: 'Ship automated weekly velocity summary export',
    description: 'Allow team leads to export task throughput metrics to JSON and CSV formats.',
    priority: 'p2',
    status: 'completed',
    dueDate: new Date().toISOString().split('T')[0],
    tags: ['analytics', 'features'],
    subtasks: [
      { id: 'sub-8', title: 'Generate CSV payload blob', completed: true },
      { id: 'sub-9', title: 'Add copy-to-clipboard action', completed: true }
    ],
    estimatedPoms: 2,
    completedPoms: 2,
    isUrgent: false,
    isImportant: true,
    createdAt: Date.now() - 86400000 * 4,
    completedAt: Date.now() - 3600000 * 2,
  }
];

export interface AppSettings {
  soundEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
  pomodoroWorkMin: number;
  pomodoroBreakMin: number;
  autoStartBreak: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  theme: 'system',
  pomodoroWorkMin: 25,
  pomodoroBreakMin: 5,
  autoStartBreak: false
};
