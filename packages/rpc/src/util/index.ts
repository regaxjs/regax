// tslint:disable:no-any
import { delay } from '@regax/common'

export async function retry<T>(fn: () => Promise<T>, times: 3, delayMs: 100): Promise<T | undefined> {
  let result: T
  while (times > 0) {
    times --
    result = await fn()
    if (result !== undefined) return result
    await delay(delayMs)
  }
}

export function normalizeDirPath(p: string): string {
  p = p.endsWith('/') ? p.slice(0, -1) : p
  return p.startsWith('/') ? p : `/${p}`
}
