// tslint:disable:no-any
import { inject, Component, injectable, Application } from '@regax/server'
import RPC from '@regax/server/lib/component/rpc'

@injectable()
export default class RegaxEggMasterComponent implements Component {
  constructor(
    @inject('app') protected readonly app: Application,
    @inject('rpc') protected readonly rpc: RPC,
  ) {
  }
  onServiceRegistry(): any {
    return {
    }
  }
  onStart(): void {
    // register the egg agent rpc server
    this.rpc.rpcRegistry.register(this.app.customConfigs.__eggAgentServerInfo)
  }
}
