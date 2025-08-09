type Listener = {
  id: symbol; // ID único para cada listener
  callback: (...args: any[]) => void;
  once: boolean;
};

type CallbackData = { event: string; args: any[] };
type AnyListener = {
  id: symbol;
  callback: (eventAndData: CallbackData) => void;
  originalCallback: (event: string, ...args: any[]) => void;
  once: boolean;
};

export class Emitter {
  private listeners: Map<string, Listener[]>;
  private anyListeners: AnyListener[];
  private maxListeners: number;

  constructor() {
    this.listeners = new Map();
    this.anyListeners = [];
    this.maxListeners = 100;
  }

  // Registra un listener que se ejecutará cada vez que se emita el evento
  public on(event: string, callback: (...args: any[]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const listeners = this.listeners.get(event)!;
    
    // Verificar límite de listeners
    if (listeners.length >= this.maxListeners) {
      console.warn(`MaxListenersExceededWarning: Possible EventEmitter memory leak detected. ${listeners.length + 1} listeners added for event "${event}". Use setMaxListeners() to increase limit.`);
    }

    const id = Symbol('listener');
    listeners.push({ id, callback, once: false });

    // Devuelve una función para remover el listener usando el ID único
    return () => {
      const currentListeners = this.listeners.get(event);
      if (currentListeners) {
        const filtered = currentListeners.filter((listener) => listener.id !== id);
        if (filtered.length === 0) {
          this.listeners.delete(event);
        } else {
          this.listeners.set(event, filtered);
        }
      }
    };
  }

  // Registra un listener que se ejecutará solo una vez
  public once(event: string, callback: (...args: any[]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const listeners = this.listeners.get(event)!;
    const id = Symbol('once-listener');
    listeners.push({ id, callback, once: true });

    // Devuelve una función para remover el listener usando el ID único
    return () => {
      const currentListeners = this.listeners.get(event);
      if (currentListeners) {
        const filtered = currentListeners.filter((listener) => listener.id !== id);
        if (filtered.length === 0) {
          this.listeners.delete(event);
        } else {
          this.listeners.set(event, filtered);
        }
      }
    };
  }

  // Registra un listener que se ejecutará para cualquier evento
  public onAny(callback: (event: string, ...args: any[]) => void): () => void {
    const wrappedCallback = (eventAndData: CallbackData) => {
      callback(eventAndData.event, ...eventAndData.args);
    };
    
    const id = Symbol('any-listener');
    const anyListener: AnyListener = {
      id,
      callback: wrappedCallback,
      originalCallback: callback,
      once: false
    };
    
    this.anyListeners.push(anyListener);

    // Devuelve una función para remover el listener usando el ID único
    return () => {
      this.anyListeners = this.anyListeners.filter((listener) => listener.id !== id);
    };
  }

  // Registra un listener que se ejecutará una sola vez para cualquier evento
  public onceAny(callback: (event: string, ...args: any[]) => void): () => void {
    const wrappedCallback = (eventAndData: CallbackData) => {
      callback(eventAndData.event, ...eventAndData.args);
    };
    
    const id = Symbol('once-any-listener');
    const anyListener: AnyListener = {
      id,
      callback: wrappedCallback,
      originalCallback: callback,
      once: true
    };
    
    this.anyListeners.push(anyListener);

    // Devuelve una función para remover el listener usando el ID único
    return () => {
      this.anyListeners = this.anyListeners.filter((listener) => listener.id !== id);
    };
  }

  // Emite un evento con los datos proporcionados
  public emit(event: string, ...args: any[]): boolean {
    let hasListeners = false;

    // Ejecutar listeners específicos del evento
    const listeners = this.listeners.get(event);
    if (listeners && listeners.length > 0) {
      hasListeners = true;
      
      // Crear una copia para evitar problemas si se modifica durante la ejecución
      const listenersToExecute = [...listeners];
      const listenersToRemove: symbol[] = [];
      
      // Ejecutar todos los listeners
      listenersToExecute.forEach((listener) => {
        try {
          listener.callback(...args); // Cambié 'data' por '...args'
          // Marcar para remoción si es "once"
          if (listener.once) {
            listenersToRemove.push(listener.id);
          }
        } catch (error) {
          console.error(`Error in listener for event "${event}":`, error);
          // Si hay error y es "once", también lo marcamos para remoción
          if (listener.once) {
            listenersToRemove.push(listener.id);
          }
        }
      });

      // Remover los listeners "once" después de la ejecución
      if (listenersToRemove.length > 0) {
        const remainingListeners = listeners.filter(
          (listener) => !listenersToRemove.includes(listener.id)
        );
        
        if (remainingListeners.length === 0) {
          this.listeners.delete(event);
        } else {
          this.listeners.set(event, remainingListeners);
        }
      }
    }

    // Ejecutar listeners "any"
    if (this.anyListeners.length > 0) {
      hasListeners = true;
      
      // Crear una copia para evitar problemas si se modifica durante la ejecución
      const anyListenersToExecute = [...this.anyListeners];
      const anyListenersToRemove: symbol[] = [];
      
      anyListenersToExecute.forEach((listener) => {
        try {
          listener.callback({ event, args }); // Cambié 'data' por 'args'
          // Marcar para remoción si es "once"
          if (listener.once) {
            anyListenersToRemove.push(listener.id);
          }
        } catch (error) {
          console.error(`Error in "any" listener for event "${event}":`, error);
          // Si hay error y es "once", también lo marcamos para remoción
          if (listener.once) {
            anyListenersToRemove.push(listener.id);
          }
        }
      });

      // Remover los listeners "once" de anyListeners
      if (anyListenersToRemove.length > 0) {
        this.anyListeners = this.anyListeners.filter(
          (listener) => !anyListenersToRemove.includes(listener.id)
        );
      }
    }

    return hasListeners;
  }

  // Remueve un listener específico
  public off(event: string, callback: (...args: any[]) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const filtered = listeners.filter((listener) => listener.callback !== callback);
      if (filtered.length === 0) {
        this.listeners.delete(event);
      } else {
        this.listeners.set(event, filtered);
      }
    }
  }

  // Remueve todos los listeners de un evento específico
  public removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
      this.anyListeners = [];
    }
  }

  // Obtiene la cantidad de listeners para un evento
  public listenerCount(event: string): number {
    const listeners = this.listeners.get(event);
    return listeners ? listeners.length : 0;
  }

  // Obtiene todos los nombres de eventos que tienen listeners
  public eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }

  // Establece el número máximo de listeners por evento
  public setMaxListeners(n: number): void {
    this.maxListeners = n;
  }

  // Obtiene el número máximo de listeners por evento
  public getMaxListeners(): number {
    return this.maxListeners;
  }

  // Obtiene los listeners de un evento específico
  public getListeners(event: string): ((...args: any[]) => void)[] {
    const listeners = this.listeners.get(event);
    return listeners ? listeners.map(l => l.callback) : [];
  }

  // Obtiene los listeners "any"
  public getAnyListeners(): ((event: string, ...args: any[]) => void)[] {
    return this.anyListeners.map(l => l.originalCallback);
  }

  // Prepend listener (añade al principio de la lista)
  public prependListener(event: string, callback: (...args: any[]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const listeners = this.listeners.get(event)!;
    const id = Symbol('prepend-listener');
    listeners.unshift({ id, callback, once: false });

    return () => {
      const currentListeners = this.listeners.get(event);
      if (currentListeners) {
        const filtered = currentListeners.filter((listener) => listener.id !== id);
        if (filtered.length === 0) {
          this.listeners.delete(event);
        } else {
          this.listeners.set(event, filtered);
        }
      }
    };
  }

  // Prepend once listener
  public prependOnceListener(event: string, callback: (...args: any[]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const listeners = this.listeners.get(event)!;
    const id = Symbol('prepend-once-listener');
    listeners.unshift({ id, callback, once: true });

    return () => {
      const currentListeners = this.listeners.get(event);
      if (currentListeners) {
        const filtered = currentListeners.filter((listener) => listener.id !== id);
        if (filtered.length === 0) {
          this.listeners.delete(event);
        } else {
          this.listeners.set(event, filtered);
        }
      }
    };
  }

  // Método para emitir de forma asíncrona
  public async emitAsync(event: string, ...args: any[]): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const result = this.emit(event, ...args); // Cambié 'data' por '...args'
        resolve(result);
      }, 0);
    });
  }

  // Método para obtener información de depuración
  public debug(): { 
    totalEvents: number; 
    totalListeners: number; 
    anyListeners: number; 
    events: Record<string, number>;
    memoryInfo: {
      listenersMap: number;
      anyListenersArray: number;
    }
  } {
    const events: Record<string, number> = {};
    let totalListeners = 0;

    this.listeners.forEach((listeners, event) => {
      events[event] = listeners.length;
      totalListeners += listeners.length;
    });

    return {
      totalEvents: this.listeners.size,
      totalListeners,
      anyListeners: this.anyListeners.length,
      events,
      memoryInfo: {
        listenersMap: this.listeners.size,
        anyListenersArray: this.anyListeners.length
      }
    };
  }

  // Método para limpiar completamente el emitter
  public destroy(): void {
    this.listeners.clear();
    this.anyListeners = [];
  }

  // Método para verificar si hay listeners para un evento
  public hasListeners(event: string): boolean {
    const listeners = this.listeners.get(event);
    return (listeners && listeners.length > 0) || this.anyListeners.length > 0;
  }
}

export const emitter = new Emitter();
export default Emitter;