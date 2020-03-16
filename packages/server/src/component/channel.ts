import { Application, inject, Component, injectable } from '../api'
import { ChannelService } from '../service/channelService'

export * from '../service/channelService'

@injectable()
export default class ChannelComponent implements Component {
  constructor(
    @inject(Application) protected readonly app: Application,
  ) {
  }
  onServiceRegistry(): ChannelService {
    return new ChannelService(this.app)
  }
}
