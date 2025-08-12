export class Emitter {
    constructor() {
        this.listeners = new Map();
        this.anyListeners = [];
        this.maxListeners = 100;
    }
    // Registra un listener que se ejecutará cada vez que se emita el evento
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        const listeners = this.listeners.get(event);
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
                }
                else {
                    this.listeners.set(event, filtered);
                }
            }
        };
    }
    // Registra un listener que se ejecutará solo una vez
    once(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        const listeners = this.listeners.get(event);
        const id = Symbol('once-listener');
        listeners.push({ id, callback, once: true });
        // Devuelve una función para remover el listener usando el ID único
        return () => {
            const currentListeners = this.listeners.get(event);
            if (currentListeners) {
                const filtered = currentListeners.filter((listener) => listener.id !== id);
                if (filtered.length === 0) {
                    this.listeners.delete(event);
                }
                else {
                    this.listeners.set(event, filtered);
                }
            }
        };
    }
    // Registra un listener que se ejecutará para cualquier evento
    onAny(callback) {
        const wrappedCallback = (eventAndData) => {
            callback(eventAndData.event, ...eventAndData.args);
        };
        const id = Symbol('any-listener');
        const anyListener = {
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
    onceAny(callback) {
        const wrappedCallback = (eventAndData) => {
            callback(eventAndData.event, ...eventAndData.args);
        };
        const id = Symbol('once-any-listener');
        const anyListener = {
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
    emit(event, ...args) {
        let hasListeners = false;
        // Ejecutar listeners específicos del evento
        const listeners = this.listeners.get(event);
        if (listeners && listeners.length > 0) {
            hasListeners = true;
            // Crear una copia para evitar problemas si se modifica durante la ejecución
            const listenersToExecute = [...listeners];
            const listenersToRemove = [];
            // Ejecutar todos los listeners
            listenersToExecute.forEach((listener) => {
                try {
                    listener.callback(...args); // Cambié 'data' por '...args'
                    // Marcar para remoción si es "once"
                    if (listener.once) {
                        listenersToRemove.push(listener.id);
                    }
                }
                catch (error) {
                    console.error(`Error in listener for event "${event}":`, error);
                    // Si hay error y es "once", también lo marcamos para remoción
                    if (listener.once) {
                        listenersToRemove.push(listener.id);
                    }
                }
            });
            // Remover los listeners "once" después de la ejecución
            if (listenersToRemove.length > 0) {
                const remainingListeners = listeners.filter((listener) => !listenersToRemove.includes(listener.id));
                if (remainingListeners.length === 0) {
                    this.listeners.delete(event);
                }
                else {
                    this.listeners.set(event, remainingListeners);
                }
            }
        }
        // Ejecutar listeners "any"
        if (this.anyListeners.length > 0) {
            hasListeners = true;
            // Crear una copia para evitar problemas si se modifica durante la ejecución
            const anyListenersToExecute = [...this.anyListeners];
            const anyListenersToRemove = [];
            anyListenersToExecute.forEach((listener) => {
                try {
                    listener.callback({ event, args }); // Cambié 'data' por 'args'
                    // Marcar para remoción si es "once"
                    if (listener.once) {
                        anyListenersToRemove.push(listener.id);
                    }
                }
                catch (error) {
                    console.error(`Error in "any" listener for event "${event}":`, error);
                    // Si hay error y es "once", también lo marcamos para remoción
                    if (listener.once) {
                        anyListenersToRemove.push(listener.id);
                    }
                }
            });
            // Remover los listeners "once" de anyListeners
            if (anyListenersToRemove.length > 0) {
                this.anyListeners = this.anyListeners.filter((listener) => !anyListenersToRemove.includes(listener.id));
            }
        }
        return hasListeners;
    }
    // Remueve un listener específico
    off(event, callback) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            const filtered = listeners.filter((listener) => listener.callback !== callback);
            if (filtered.length === 0) {
                this.listeners.delete(event);
            }
            else {
                this.listeners.set(event, filtered);
            }
        }
    }
    // Remueve todos los listeners de un evento específico
    removeAllListeners(event) {
        if (event) {
            this.listeners.delete(event);
        }
        else {
            this.listeners.clear();
            this.anyListeners = [];
        }
    }
    // Obtiene la cantidad de listeners para un evento
    listenerCount(event) {
        const listeners = this.listeners.get(event);
        return listeners ? listeners.length : 0;
    }
    // Obtiene todos los nombres de eventos que tienen listeners
    eventNames() {
        return Array.from(this.listeners.keys());
    }
    // Establece el número máximo de listeners por evento
    setMaxListeners(n) {
        this.maxListeners = n;
    }
    // Obtiene el número máximo de listeners por evento
    getMaxListeners() {
        return this.maxListeners;
    }
    // Obtiene los listeners de un evento específico
    getListeners(event) {
        const listeners = this.listeners.get(event);
        return listeners ? listeners.map(l => l.callback) : [];
    }
    // Obtiene los listeners "any"
    getAnyListeners() {
        return this.anyListeners.map(l => l.originalCallback);
    }
    // Prepend listener (añade al principio de la lista)
    prependListener(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        const listeners = this.listeners.get(event);
        const id = Symbol('prepend-listener');
        listeners.unshift({ id, callback, once: false });
        return () => {
            const currentListeners = this.listeners.get(event);
            if (currentListeners) {
                const filtered = currentListeners.filter((listener) => listener.id !== id);
                if (filtered.length === 0) {
                    this.listeners.delete(event);
                }
                else {
                    this.listeners.set(event, filtered);
                }
            }
        };
    }
    // Prepend once listener
    prependOnceListener(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        const listeners = this.listeners.get(event);
        const id = Symbol('prepend-once-listener');
        listeners.unshift({ id, callback, once: true });
        return () => {
            const currentListeners = this.listeners.get(event);
            if (currentListeners) {
                const filtered = currentListeners.filter((listener) => listener.id !== id);
                if (filtered.length === 0) {
                    this.listeners.delete(event);
                }
                else {
                    this.listeners.set(event, filtered);
                }
            }
        };
    }
    // Método para emitir de forma asíncrona
    async emitAsync(event, ...args) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const result = this.emit(event, ...args); // Cambié 'data' por '...args'
                resolve(result);
            }, 0);
        });
    }
    // Método para obtener información de depuración
    debug() {
        const events = {};
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
    destroy() {
        this.listeners.clear();
        this.anyListeners = [];
    }
    // Método para verificar si hay listeners para un evento
    hasListeners(event) {
        const listeners = this.listeners.get(event);
        return (listeners && listeners.length > 0) || this.anyListeners.length > 0;
    }
}
export const emitter = new Emitter();
export default Emitter;
//# sourceMappingURL=Emitter.js.map