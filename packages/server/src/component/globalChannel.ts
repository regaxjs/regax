// tslint:disable:no-any
import { Application } from '../application'
import { inject, Component, injectable } from '../api'
import { GlobalChannelService } from '../service/globalChannelService'
import { RemoteCache } from '@regax/rpc'
import RPC from './rpc'

export interface GlobalChannelOpts {
  enableReadyCheck?: boolean,
  channelPrefix?: string,
  createRemoteCache?: (opts: GlobalChannelOpts) => RemoteCache,
  RemoteCache: any,
}

@injectable()
export default class GlobalChannelComponent implements Component {
  protected remoteCache?: any
  constructor(
    @inject(Application) protected readonly app: Application,
    @inject(RPC) protected readonly rpc: RPC,
  ) {
  }
  onStart(config: GlobalChannelOpts): void {
    if (config.createRemoteCache) {
      this.remoteCache = config.createRemoteCache(config)
    }
  }
  onServiceRegistry(config: GlobalChannelOpts): GlobalChannelService | void {
    if (this.remoteCache) {
      return new GlobalChannelService(this.app, this.rpc, this.remoteCache, config.channelPrefix)
    }
  }
}
