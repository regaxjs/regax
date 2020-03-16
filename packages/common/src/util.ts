// tslint:disable:no-any
const keys = Object.keys
import { Fn } from './types'

export const partial = (fn: Fn, ...args: any[]) => (...rest: any[]) => fn(...args, ...rest)

export const partialRight = (fn: Fn, ...args: any[]) => (...rest: any[]) => fn(...rest, ...args)

export const each = (obj: any, fn: (value: any, key: string) => void) => keys(obj).forEach(key => fn(obj[key], key))

export const values = (obj: any) => Object.values ? Object.values(obj) : keys(obj).map(k => obj[k])

export const filter = (obj: any, fn: (value: any, key: string) => boolean, dest?: any) =>
  keys(obj).reduce((output, key) => fn(obj[key], key) ? Object.assign(output, { [key]: obj[key]}) : output, dest || {})

export const pick = (obj: any, fields: string[], dest?: any) => filter(obj, (n, k) => fields.indexOf(k) !== -1, dest)

export const omit = (obj: any, fields: string[], dest?: any) => filter(obj, (n, k) => fields.indexOf(k) === -1, dest)

export const reduce = <T = any>(obj: any, fn: (res: any, value: any, key: string) => T, res: T) => keys(obj).reduce((r, k) => fn(r, obj[k], k), res)

export const mapValues = (obj: any, fn: (value: any, key: string) => any) => reduce(obj, (res, value, key) => Object.assign(res, { [key]: fn(value, key) }), {})

export const mapKeys = (obj: any, fn: (value: any, key: string) => any) => reduce(obj, (res, value, key) => Object.assign(res, { [fn(value, key)]: value }), {})

export const delay = (ms: number) => new Promise((res: any) => setTimeout(res, ms))
