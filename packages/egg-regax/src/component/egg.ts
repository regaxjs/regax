// tslint:disable:no-any
import { inject, Component, injectable, Application } from '@regax/server'
import RPC from '@regax/server/lib/component/rpc'
// import { createProxy } from '@regax/server/lib/util/proxy'

@injectable()
export default class RegaxEggComponent implements Component {
  constructor(
    @inject('app') protected readonly app: Application,
    @inject('rpc') protected readonly rpc: RPC,
  ) {
  }
  onServiceRegistry(): any {
    const self = this
    const eggConfig = self.app.customConfigs.__eggConfig
    return {
      get(key: string): Promise<any> {
        return self.invokeEggContext(key)
      },
      invoke: (key: string, args: any[]) => self.invokeEggContext(key, args),
      getService: (key: string) => (...args: any) => this.invokeEggContext(`service.${key}`, args),
      config: eggConfig
    }
  }
  invokeEggContext(key: string, args: any[] = []): Promise<any> {
    const serverId = this.rpc.rpcClient.getServersByType('egg-agent')[0]
    return this.rpc.rpcClient.rpcInvoke(serverId, 'eggContext', [{ key, args }])
  }
}
