import { Component, injectable, inject, Application } from '@regax/server'

@injectable()
export default class MyComponent implements Component {
  constructor(
    @inject(Application) protected readonly app: Application
  ) {
  }
  onStart(): void {
    // console.log('on plugin start ')
  }
  /**
   *  Use "this.app.service.my.method" to invoke
   */
  onServiceRegistry(): { method: () => void } {
    return {
      method(): void {
      }
    }
  }
}
