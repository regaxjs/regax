import { injectable, inject } from 'inversify'
import { Application, Component } from '../api'
import { SessionService } from '../service/sessionService'

export * from '../service/sessionService'

export interface SessionOpts {
  singleSession?: boolean
}

@injectable()
export default class SessionComponent implements Component  {
  constructor(
   @inject(Application) protected app: Application
  ) {
  }
  onServiceRegistry(): SessionService {
    return new SessionService(this.app, this.app.getConfig<SessionOpts>('session') || {})
  }
}
