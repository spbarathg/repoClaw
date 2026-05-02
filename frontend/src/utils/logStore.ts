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
    // Only pass the reference, let the component handle rendering optimization
    // We pass a shallow copy to ensure React detects the change if it checks equality
    const currentLogs = [...this.logs];
    this.listeners.forEach(l => l(currentLogs));
  }
}

export const logStore = new LogStore();
