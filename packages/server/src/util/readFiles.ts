import * as fs from './fs'
import * as path from 'path'

// support ts
const defaultLoadFilter = (name: string): boolean => (path.extname(name) === '.ts' && !/.d.ts$/.test(name)) || path.extname(name) === '.js'

export function readFiles<T>(dir: string, fn: (fullPath: string, name: string) => T, filter: (name: string) => boolean = defaultLoadFilter): { [key: string]: T } {
  let list = fs.safeReaddirSync(dir)
  if (filter) {
    list = list.filter(n => filter(n))
  }
  return list
    .reduce((res: { [key: string]: T }, key: string): { [key: string]: T } => {
      // remove file extname
      const name = key.replace(/\.[^\.]+$/, '')
      // maybe ts loaded
      if (name in res) return res
      res[name] = fn(path.join(dir, name), name)
      return res
    }, {})
}
