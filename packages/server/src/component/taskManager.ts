import { injectable, inject } from 'inversify'
import { SeqQueue } from '../util/queue'
import { Component, Application } from '../api'
import { Fn } from '@regax/common'

@injectable()
export default class TaskManager implements Component  {
  static timeout = 3000
  protected queues: Map<string | number, SeqQueue> = new Map()
  constructor(
    @inject(Application) protected app: Application
  ) {
  }
  onServiceRegistry(): TaskManager {
    return this
  }
  /**
   * Add tasks into task group. Create the task group if it dose not exist.
   *
   * @param key       task key
   * @param fn        task callback
   * @param onTimeout task timeout callback
   * @param timeout   timeout for task
   */
  addTask(key: string | number, fn: Fn<void>, onTimeout?: Fn<void>, timeout?: number): boolean {
    let queue = this.queues.get(key)
    if (!queue) {
      queue = new SeqQueue(TaskManager.timeout)
      this.queues.set(key, queue)
    }

    return queue.push(fn, onTimeout, timeout)
  }
  /**
   * Destroy task group
   *
   * @param  {String} key   task key
   * @param  {Boolean} force whether close task group directly
   */
  closeQueue(key: string | number, force: boolean): void {
    if (!this.queues.has(key)) {
      // ignore illeagle key
      return
    }
    this.queues.get(key)!.close(force)
    this.queues.delete(key)
  }
}
