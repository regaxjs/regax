// tslint:disable:no-any
import * as path from 'path'
import * as fs from 'fs'

export function safeReaddirSync(dirname: string, fullPath =  false): string[] {
  if (fs.existsSync(dirname)) {
    const list = fs.readdirSync(dirname)
    return fullPath ? list.map(l => path.join(dirname, l)) : list
  }
  return []
}

export function tryToRequire(filePath: string): any {
  if (fs.existsSync(`${filePath}.js`) || fs.existsSync(`${filePath}.ts`)) {
    const module = require(filePath)
    return module && module.default ? module.default : module
  }
}
