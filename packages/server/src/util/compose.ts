// tslint:disable:no-any
// Fork from https://github.com/koajs/compose/blob/master/index.js

export interface ComposeMiddleware {
  (...args: any): any,
}
export interface ComposeDispatcher<Context> {
  (context: Context, next: any): Promise<void>
}

export function compose<Context>(middlewares: ComposeMiddleware[]): ComposeDispatcher<Context> {
  if (!Array.isArray(middlewares)) throw new TypeError('Middleware stack must be an array!')
  for (const fn of middlewares) {
    if (typeof fn !== 'function') throw new TypeError('Middleware must be composed of functions!')
  }
  return (context, next) => {
    let index = -1
    return dispatch(0)
    function dispatch(i: number, error?: string | Error): Promise<any> {
      if (error) return Promise.reject(typeof error === 'string' ? new Error(error) : error)
      if (i <= index) return Promise.reject(new Error('next() called multiple times'))
      index = i
      let fn = middlewares[i]
      if (i === middlewares.length) fn = next
      if (!fn) return Promise.resolve()
      try {
        return Promise.resolve(fn(context, dispatch.bind(undefined, i + 1)))
      } catch (err) {
        return Promise.reject(err)
      }
    }
  }
}
