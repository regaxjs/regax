import { Application } from '../application'
import { RemoteCache } from '@regax/rpc'
import RPC from '../component/rpc'

type SID = string | number // frontend server id
type UID = string | number // user id

export const DEFAULT_CHANNEL_PREFIX = 'REGAX:CHANNEL'
// tslint:disable:no-any
export class GlobalChannelService {
  constructor(
    protected readonly app: Application,
    protected readonly rpc: RPC,
    protected readonly remoteCache: RemoteCache, // like ioredis
    protected readonly channelPrefix: string = DEFAULT_CHANNEL_PREFIX,
  ) {}
  async add(name: string, sid: SID, uid: UID): Promise<void> {
    const key = this.genKey(name, sid)
    await this.remoteCache.sadd(key, uid)
  }
  async leave(name: string, sid: SID, uid: UID): Promise<void> {
    const key = this.genKey(name, sid)
    await this.remoteCache.srem(key, uid)
  }
  async getMembersBySid(name: string, sid: SID): Promise<UID[]> {
    const key = this.genKey(name, sid)
    return this.remoteCache.smembers(key)
  }
  async getMembersByChannelName(name: string, serverType: string): Promise<UID[]> {
    const servers = this.rpc.getServersByType(serverType)
    if (servers.length === 0) return []
    const uids: any = {}
    for (let i = 0, l = servers.length; i < l; i++) {
      const items = await this.getMembersBySid(name, servers[i])
      items.forEach(item => (uids[item] = 1))
    }
    return Object.keys(uids)
  }
  async destroyChannel(name: string, serverType: string): Promise<void> {
    const servers = this.rpc.getServersByType(serverType)
    if (servers.length === 0) return
    for (let i = 0, l = servers.length; i < l; i++) {
      await this.remoteCache.del(this.genKey(name, servers[i]))
    }
  }
  async pushMessage(serverType: string, channelName: string, route: string, msg: any): Promise<void> {
    const servers = this.rpc.getServersByType(serverType)
    if (servers.length === 0) return
    const rpc = this.app.service.rpc
    for (let i = 0, l = servers.length; i < l; i++) {
      const serverId = servers[i]
      const uids = await this.getMembersBySid(channelName, servers[i])
      if (uids.length > 0) {
        rpc.remote(serverId).channel.pushMessage(route, msg, uids)
      }
    }
  }
  protected genKey(name: string, sid: SID): string {
    return `${this.channelPrefix}:${name}:${sid}`
  }
}
