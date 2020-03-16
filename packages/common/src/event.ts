// tslint:disable:no-any
export interface EventListener {
  (...args: any[]): any,
  fn?: (...args: any[]) => any,
}

interface EventRemove {
  (): void
}

export interface EventEmitter<T> {
  readonly event?: any,
  on(event: T & string, fn: EventListener): EventRemove
  once(event: T & string, fn: EventListener): EventRemove
  off(event: T & string, fn?: EventListener): void
  emit(event: T & string, ...args: any): void
}

export class EventEmitter<T> {
  protected listeners?: { [key: string]: EventListener[] }
  on(event: T & string, fn: EventListener): EventRemove {
    if (!this.listeners) this.listeners = {};
    (this.listeners[event] = this.listeners[event] || []).push(fn)
    return () => this.off(event, fn)
  }
  once(event: T & string, fn: EventListener): EventRemove {
    const listener: EventListener = (...args) => {
      this.off(event, listener)
      fn.apply(this, args)
    }
    listener.fn = fn
    return this.on(event, fn)
  }
  off(event?: T & string, fn?: EventListener): void {
    // remove all listeners
    if (!event || !this.listeners) {
      this.listeners = undefined
      return
    }
    const currentListeners = this.listeners[event]
    if (!currentListeners) return
    if (!fn) {
      delete this.listeners[event]
      return
    }
    for (let i = 0; i < currentListeners.length; i++) {
      const cb = currentListeners[i]
      if (cb === fn || cb.fn === fn) {
        currentListeners.splice(i, 1)
        break
      }
    }
  }
  emit(event: T & string, ...args: any[]): void {
    const currentListeners = (this.listeners || {})[event]
    if (!currentListeners || currentListeners.length === 0) return
    for (let i = 0; i < currentListeners.length; i ++) {
      currentListeners[i].apply(this, args)
    }
  }
}
