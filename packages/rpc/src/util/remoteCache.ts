import { normalizeDirPath } from './index'
import { delay } from '@regax/common'

// tslint:disable:no-any
export interface RemoteCache {
  exists(key: string): Promise<boolean>
  set(key: string, value: any, exSeconds?: number): Promise<void>
  get(key: string, exSeconds?: number): Promise<any | undefined>
  del(key: string): Promise<void>
  sadd(key: string, value: any): Promise<void>
  smembers(key: string): Promise<any[]>
  srem(key: string, value: any): Promise<void>
  scard(key: string): Promise<number>
  hset(key: string, field: string, value: any): Promise<void>
  hget(key: string, field: string): Promise<any | undefined>
  hdel(key: string, field: string): Promise<void>
  hlen(key: string): Promise<number>
  incr(key: string): Promise<number>
  decr(key: string): Promise<number>
}

export interface SimpleRemoteCache {
  set(key: string, value: any, exSeconds?: number): Promise<void>
  get(key: string, exSeconds?: number): Promise<any | undefined>
  del(key: string): Promise<void>
}

let single: RemoteCache

export class RemoteCache implements RemoteCache {
  private sets: {[key: string]: Set<any>} = {}
  private hashs: {[key: string]: Map<string, any>} = {}
  private keys: {[name: string]: any } = {}
  private timeouts: {[name: string]: NodeJS.Timer} = {}
  constructor(
    readonly opts: { singleMode?: boolean } = {}
  ) {
    if (opts.singleMode === undefined || opts.singleMode) {
      if (!single) single = this
      return single
    }
  }
  async exists(key: string): Promise<boolean> {
    return this.keys[key] !== undefined || this.hashs[key] !== undefined || (this.sets[key] !== undefined && this.sets[key].size !== 0)
  }
  async set(key: string, value: any, exSeconds?: number): Promise<void> {
    // ensure previous timeout is clear before setting another one.
    if (this.timeouts[key]) clearTimeout(this.timeouts[key])
    this.keys[key] = value
    if (exSeconds) {
      this.timeouts[key] = setTimeout(() => {
        delete this.keys[key]
        delete this.timeouts[key]
      }, exSeconds * 1000)
    }
  }
  async get(key: string, exSeconds?: number): Promise<any | undefined> {
    if (exSeconds) {
      // clear previous timeout
      if (this.timeouts[key]) clearTimeout(this.timeouts[key])
      this.timeouts[key] = setTimeout(() => {
        delete this.keys[key]
        delete this.timeouts[key]
      }, exSeconds * 1000)
    }
    return this.keys[key]
  }
  async del(key: string): Promise<void> {
    if (this.timeouts[key]) clearTimeout(this.timeouts[key])
    delete this.timeouts[key]
    delete this.keys[key]
    delete this.sets[key]
    delete this.hashs[key]
  }
  async sadd(key: string, value: any): Promise<void> {
    if (!this.sets[key]) {
      this.sets[key] = new Set<string>()
    }
    this.sets[key].add(value)
  }

  async smembers(key: string): Promise<any[]> {
    const result: any[] = []
    this.sets[key].forEach((item: string) => result.push(item))
    return result
  }

  async srem(key: string, value: any): Promise<void> {
    const set = this.sets[key]
    if (set && set.has(value)) {
      set.delete(value)
      if (set.size === 0) delete this.sets[key]
    }
  }

  async scard(key: string): Promise<number> {
    return (this.sets[key] || new Set()).size
  }

  async sinter(...keys: string[]): Promise<any[]> {
    const result: any[] = []
    const intersection = new Map()
    for (let i = 0, l = keys.length; i < l; i++) {
      this.sets[keys[i]].forEach(item => {
        if (!intersection.has(item)) {
          intersection.set(item, 0)
        }
        intersection.set(item, intersection.get(item) + 1)
      })
    }
    intersection.forEach((num, item) => num > 1 ? result.push(item) : undefined)
    return result
  }

  async hset(key: string, field: string, value: any): Promise<void> {
    if (!this.hashs[key]) {
      this.hashs[key] = new Map()
    }
    this.hashs[key].set(field, value)
  }

  async hget(key: string, field: string): Promise<any | undefined> {
    return this.hashs[key] && this.hashs[key].get(field)
  }

  async hdel(key: string, field: string): Promise<void> {
    let hash
    if (hash = this.hashs[key]) {
      hash.delete(field)
      if (hash.size === 0) delete this.hashs[key]
    }
  }

  async hlen(key: string): Promise<number> {
    return this.hashs[key] && this.hashs[key].size
  }

  async incr(key: string): Promise<number> {
    if (!this.keys[key]) {
      this.keys[key] = 0
    }
    (this.keys[key] as number)++
    return this.keys[key] as number
  }

  async decr(key: string): Promise<number> {
    if (!this.keys[key]) {
      this.keys[key] = 0
    }
    (this.keys[key] as number)--
    return this.keys[key] as number
  }
}

export interface RemoteFsDirInfo {
  version: number,
  files: { [fileName: string]: any }
}
export class RemoteFs {
  constructor(
    readonly remoteCache: SimpleRemoteCache,
    readonly dir: string,
    readonly expiredTime: number = 24 * 60 * 60 // 1 day
  ) {
    this.dir = normalizeDirPath(dir)
  }
  async readdir(waitLock = true): Promise<RemoteFsDirInfo> {
    if (waitLock) await this.waitLock()
    const data = await this.remoteCache.get(this.dir, this.expiredTime)
    if (!data) return { version: 0, files: {} }
    return JSON.parse(data)
  }
  async writedir(data: RemoteFsDirInfo): Promise<void> {
    if (Object.keys(data.files).length === 0) {
      await this.remoteCache.del(this.dir)
      return
    }
    await this.remoteCache.set(this.dir, JSON.stringify(data), this.expiredTime)
  }
  async exists(fileName: string): Promise<boolean> {
    const data = await this.readdir()
    return !!data.files[fileName]
  }
  async writeFile(fileName: string, content: any): Promise<void> {
    await this.waitLock()
    await this.lock()
    const data = await this.readdir(false)
    if (JSON.stringify(content) !== JSON.stringify(data.files[fileName])) {
      data.version ++
    }
    data.files[fileName] = content
    await this.writedir(data)
    await this.unlock()
  }
  async removeFiles(...files: string[]): Promise<void> {
    if (files.length === 0) return
    await this.waitLock()
    await this.lock()
    const data = await this.readdir(false)
    let changed = false
    files.forEach(fileName => {
      if (data.files[fileName] === undefined) return
      changed = true
      delete data.files[fileName]
    })
    if (changed) {
      data.version ++
      await this.writedir(data)
    }
    if (Object.keys(data.files).length === 0) {
      await this.removedir()
    }
    await this.unlock()
  }
  async lock(): Promise<void> {
    await this.remoteCache.set(`${this.dir}.locked`, 1, 10)
  }
  async unlock(): Promise<void> {
    await this.remoteCache.del(`${this.dir}.locked`)
  }
  async isLocked(): Promise<boolean> {
    return !!(await this.remoteCache.get(`${this.dir}.locked`))
  }
  async removedir(): Promise<void> {
    await this.remoteCache.del(this.dir)
  }
  async waitLock(expiredTime = 10000): Promise<void> {
    if (expiredTime < 0) return
    if (await this.isLocked()) {
      expiredTime = expiredTime - 500
      await delay(500)
      return this.waitLock(expiredTime)
    }
  }
  async readFile(fileName: string): Promise<any> {
    const data = await this.readdir()
    return data.files[fileName]
  }
}
