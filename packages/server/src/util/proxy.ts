// tslint:disable:no-any
/**
 * @param args - init service args
 * @param fn - service method
 * @param depth - call depth
 * @param depIndex - current dep index
 * @example
 *  const myServices = {
 *    s1: {
 *      s2: {
 *        add(a, b): number {
 *          return a + b
 *        }
 *      }
 *    }
 *  }
 *  const serviceProxy = createProxy((service1, service2, method) => {
 *    return myServices[service1][service2][method]
 *  }, 3)
 *  serviceProxy.s1.s2.add(3, 4) // 7
 */
export function createProxy<T extends object>(fn: (...args: any[]) => any, depth = 1, args: any[] = [], depIndex = 1): T {
  return new Proxy<any>({}, {
    get(t, field: string): any {
      const newArgs = args.slice()
      newArgs.push(field)
      if (depIndex === depth) {
        return fn(...newArgs)
      }
      return createProxy(fn, depth, newArgs, depIndex + 1)
    }
  })
}
