import { Application } from '../application'
import { Component, inject, injectable } from '../api'

export interface AgentOpts {
}

@injectable()
export default class AgentComponent implements Component {
  protected opts: AgentOpts
  constructor(
    @inject(Application) protected readonly app: Application,
  ) {
    this.opts = this.app.getConfig('agent') || {}
  }
  onStart(): void {
    // TODO
  }
}
