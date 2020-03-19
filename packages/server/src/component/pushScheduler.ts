// tslint:disable:no-any
import { inject, Component, injectable, Application } from '../api'
import { Tick } from '@regax/common'
import { InternalSession } from '../service/sessionService'

const DEFAULT_FLUSH_INTERVAL = 20

@injectable()
export default class PushScheduler implements Component {
  protected tick: Tick = new Tick(DEFAULT_FLUSH_INTERVAL)
  protected queueMap: Map<InternalSession, Buffer[]> = new Map()
  constructor(
    @inject(Application) protected readonly app: Application,
  ) {
  }
  onStart(): void {
  }
  onStop(): void {
    this.tick.stop()
  }
  schedule(sessions: InternalSession[], msg: Buffer): void {
    sessions.forEach(session => {
      if (session.closed) return
      if (!this.queueMap.has(session)) {
        this.queueMap.set(session, [])
        // will registry once
        session.once(session.event.CLOSED, () => {
          this.queueMap.delete(session)
        })
      }
      this.queueMap.get(session)!.push(msg)
    })
    // TODO pushScheduler is closed
    // if (!this.tick.isRunning()) {
    this.flush()
    // }
    // this.tick.next(() => this.flush())
  }
  flush(): void {
    this.queueMap.forEach((buffers, session) => {
      if (buffers.length === 0) return
      if (session.closed) this.queueMap.delete(session)
      session.sendBatch(buffers)
      buffers.length = 0
    })
  }
}
