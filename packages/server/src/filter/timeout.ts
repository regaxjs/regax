import { Application, Filter } from '../api'

const DEFAULT_TIMEOUT = 3000
const DEFAULT_SIZE = 500

export interface TimeoutFilterOpts {
  timeout: number,
  maxSize: number
}

/**
 * Filter for timeout.
 * Print a warn information when request timeout.
 */
export function TimeoutFilter(app: Application, opts: TimeoutFilterOpts): Filter {
  const timeout: number = opts.timeout || DEFAULT_TIMEOUT
  const maxSize = opts.maxSize || DEFAULT_SIZE
  let timeoutSize = 0
  return async (ctx, next) => {
    if (timeoutSize > maxSize) {
      app.logger.warn('timeout filter is out of range, current size is %s, max size is %s', timeoutSize, maxSize)
      await next()
      return
    }
    timeoutSize++
    const timeoutId = setTimeout(() => {
      app.logger.error('request %j timeout.', ctx.route)
    }, timeout)
    await next()
    clearTimeout(timeoutId)
  }
}
