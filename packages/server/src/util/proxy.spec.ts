import * as expect from 'expect'
// tslint:disable:no-any
import { createProxy } from './proxy'
describe('util.proxy', () => {
  it('util.proxy.createProxy', () => {
    const services = {
      s1: {
        s2: {
          add(n1: number, n2: number): number {
            return n1 + n2
          }
        }
      }
    }
    const servicesProxy = createProxy<any>((s1, s2, method) => {
      return (services as any)[s1][s2][method]
    }, 3)
    expect(servicesProxy.s1.s2.add(3, 4)).toEqual(7)
    // twice
    expect(servicesProxy.s1.s2.add(3, 4)).toEqual(7)
  })
})
