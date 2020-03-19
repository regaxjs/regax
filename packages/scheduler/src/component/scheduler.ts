import { inject, Component, injectable, Application } from '@regax/server'

@injectable()
export default class SchedulerComponent implements Component {
  constructor(
    @inject('app') protected readonly app: Application,
  ) {
  }
  onStart(): void {
  }
}
