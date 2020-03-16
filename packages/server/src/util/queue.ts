import { EventEmitter, Fn, MaybePromise } from '@regax/common'

const DEFAULT_TIMEOUT = 3000
export enum QueueEvent {
  CLOSED = 'closed',
  DRAINED = 'drained',
  TIMEOUT = 'timeout',
  ERROR = 'error'
}

export enum QueueStatus {
  IDLE,
  BUSY,  // queue is working for some tasks now
  CLOSED, // queue has closed and would not receive task any more and is processing the remaining tasks now.
  DRAINED, // queue is ready to be destroy
}

export interface QueueTask {
  id?: number,
  fn: Fn<void>,
  onTimeout?: Fn<void>,
  timeout?: number
}

export class SeqQueue extends EventEmitter<QueueEvent> {
  protected queue: QueueTask[] = []
  protected curId = 0
  protected status = QueueStatus.IDLE
  protected timerId?: NodeJS.Timer
  constructor(
    protected readonly timeout: number = DEFAULT_TIMEOUT
  ) {
    super()
    this.queue = []
  }
  push(fn: Fn<MaybePromise<void>>, onTimeout?: Fn, timeout?: number): boolean {
    if (this.isClosed()) return false
    this.queue.push({ fn, onTimeout, timeout })
    if (this.status === QueueStatus.IDLE) {
      this.status = QueueStatus.BUSY
      this.runTask(this.curId)
    }
    return true
  }
  isClosed(): boolean {
    return this.status !== QueueStatus.IDLE && this.status !== QueueStatus.BUSY
  }
  protected runTask(taskId: number): void {
    process.nextTick(() => {
      this.next(taskId)
    })
  }
  close(force: boolean): void {
    if (this.isClosed()) {
      // ignore invalid status
      return
    }

    if (force) {
      this.status = QueueStatus.DRAINED
      if (this.timerId) {
        clearTimeout(this.timerId)
        this.timerId = undefined
      }
      this.emit(QueueEvent.DRAINED)
    } else {
      this.status = QueueStatus.CLOSED
      this.emit(QueueEvent.CLOSED)
    }
  }
  protected async next(taskId: number): Promise<void> {
    if (taskId !== this.curId || this.status !== QueueStatus.BUSY && this.status !== QueueStatus.CLOSED) {
      // ignore invalid next call
      return
    }

    if (this.timerId) {
      clearTimeout(this.timerId)
      this.timerId = undefined
    }

    const task = this.queue.shift()
    if (!task) {
      if (this.status === QueueStatus.BUSY) {
        this.status = QueueStatus.IDLE
        this.curId++	// modify curId to invalidate timeout task
      } else {
        this.status = QueueStatus.DRAINED
        this.emit(QueueEvent.DRAINED)
      }
      return
    }

    task.id = ++this.curId

    const timeout = task.timeout ? task.timeout : this.timeout
    this.timerId = global.setTimeout(() => {
      this.runTask(task.id!)
      this.emit(QueueEvent.TIMEOUT, task)
      if (task.onTimeout) {
        task.onTimeout()
      }
    }, timeout)

    try {
      // tslint:disable-next-line
      await task.fn()
    } catch (err) {
      this.emit(QueueEvent.ERROR, err, task)
    } finally {
      // run next task
      this.runTask(task.id)
    }
  }
}
