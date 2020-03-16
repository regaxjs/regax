// tslint:disable:no-any
import * as util from 'util'
import { Logger } from '@regax/logger'
import { Fn } from '@regax/common'

export class TestLogger extends Logger {
  public msgs: { msg: string, type: string }[] = []
  log(str: string, ...args: any[]): void {
    const msg = util.format(str, ...args)
    this.msgs.push({ msg, type: 'log' })
    // console.log(msg)
  }
  info(str: string, ...args: any[]): void {
    const msg = util.format(str, ...args)
    this.msgs.push({ msg, type: 'info' })
    // console.info(msg)
  }
  warn(str: string, ...args: any[]): void {
    const msg = util.format(str, ...args)
    this.msgs.push({ msg, type: 'warn' })
    // console.warn(msg)
  }
  error(str: string, ...args: any[]): void {
    const msg = util.format(str, ...args)
    this.msgs.push({ msg, type: 'error' })
    // console.error(...args)
  }
  debug(str: string, ...args: any[]): void {
    const msg = util.format(str, ...args)
    this.msgs.push({ msg, type: 'debug' })
    // console.debug(msg)
  }
  match(str: string | RegExp, type?: string): number {
    return this.msgs.filter(m => {
      if (type && m.type !== type) return false
      return m.msg.match(str)
    }).length
  }
}

export async function expectThrow(fn: Fn, msg: string | RegExp): Promise<void> {
  let error: Error
  try {
    await fn()
  } catch (e) {
    error = e
  }
  if (!error! || !error!.message.match(msg)) {
    throw new Error(`Expect throw message "${msg}" but get: ${error! && error!.message}`)
  }
}
