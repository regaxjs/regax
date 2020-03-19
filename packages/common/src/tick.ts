const gapThreshold = 100   // tick gap threashold

export class Tick {
  protected tickId?: number
  protected tickTimeoutId?: number
  protected nextTickTimeout: number = 0
  constructor(
    protected tickInterval = 0,
    protected tickTimeout = 0
  ) {}
  isRunning(): boolean {
    return !!this.tickId
  }
  next(onTick: () => void, onTimeout?: () => void): void {
    if (!this.tickInterval) return
    if (this.tickTimeoutId) {
      clearTimeout(this.tickTimeoutId)
      this.tickTimeoutId = undefined
    }
    if (this.tickId) {
      // already in a tick interval
      return
    }
    const tickTimeoutCb = () => {
      const gap = this.nextTickTimeout - Date.now()
      if (gap > gapThreshold) {
        // @ts-ignore
        this.tickTimeoutId = setTimeout(tickTimeoutCb, gap)
      } else {
        if (onTimeout) onTimeout()
      }
    }
    // @ts-ignore
    this.tickId = setTimeout(() => {
      this.tickId = undefined
      onTick()
      if (!onTimeout) return
      this.nextTickTimeout = Date.now() + this.tickTimeout
      // @ts-ignore
      this.tickTimeoutId = setTimeout(tickTimeoutCb, this.tickTimeout)
    }, this.tickInterval)
  }
  refreshNextTickTimeout(): void {
    if (this.nextTickTimeout) {
      this.nextTickTimeout = Date.now() + this.tickTimeout
    }
  }
  setTick(tickInterval: number, tickTimeout: number = 0): void {
    this.tickInterval = tickInterval
    this.tickTimeout = tickTimeout
  }
  stop(): void {
    if (this.tickId) {
      clearTimeout(this.tickId)
      this.tickId = undefined
    }
    if (this.tickTimeoutId) {
      clearTimeout(this.tickTimeoutId)
      this.tickTimeoutId = undefined
    }
  }
}
