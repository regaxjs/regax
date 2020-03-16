import { injectable, inject } from 'inversify'
import { Component, Application } from '../api'
import { BackendSessionService } from '../service/backendSessionService'

export * from '../service/backendSessionService'

@injectable()
export default class BackendSessionComponent implements Component  {
  constructor(
    @inject(Application) protected app: Application
  ) {
  }
  onServiceRegistry(): BackendSessionService {
    return new BackendSessionService(this.app)
  }
}
