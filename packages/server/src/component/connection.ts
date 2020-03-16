import { Application, inject, Component, injectable } from '../api'
import { ConnectionService } from '../service/connectionService'

export * from '../service/connectionService'
/**
 * connection statistics service
 * record connection, login count and list
 */
@injectable()
export default class ConnectionComponent implements Component {
  constructor(
    @inject(Application) protected readonly app: Application,
  ) {
  }
  onServiceRegistry(): ConnectionService {
    return new ConnectionService(this.app)
  }
}
