type Listener = (logs: string[]) => void;

class LogStore {
  private logs: string[] = [];
  private listeners: Set<Listener> = new Set();

  append(msg: string) {
    this.logs.push(msg);
    this.notify();
  }

  clear() {
    this.logs = [];
    this.notify();
  }

  getLogs() {
    return this.logs;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.logs);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    if (this.listeners.size === 0) return;
    // Cap log history to prevent memory bloat during long pipeline runs
    if (this.logs.length > 200) {
      this.logs = this.logs.slice(-150);
    }
    const currentLogs = [...this.logs];
    this.listeners.forEach(l => l(currentLogs));
  }
}

export const logStore = new LogStore();
