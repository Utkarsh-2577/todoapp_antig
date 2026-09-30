export type Priority = 'p1' | 'p2' | 'p3' | 'p4';

export type TaskStatus = 'inbox' | 'todo' | 'in_progress' | 'review' | 'completed';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: TaskStatus;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  tags: string[];
  subtasks: Subtask[];
  estimatedPoms: number;
  completedPoms: number;
  isUrgent: boolean;
  isImportant: boolean;
  createdAt: number;
  completedAt?: number;
}

export type ViewMode = 'list' | 'today' | 'upcoming' | 'matrix' | 'kanban' | 'focus' | 'analytics';

export type FilterPriority = 'all' | Priority;
