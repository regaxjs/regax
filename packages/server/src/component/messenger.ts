// tslint:disable:no-any
import { Application, inject, Component, injectable } from '../api'
import { EventEmitter, Fn } from '@regax/common'
import { MessengerService } from '../service/messengerService'

@injectable()
export default class MessengerComponent implements Component {
  protected emitter = new EventEmitter<string>()
  constructor(
    @inject(Application) protected readonly app: Application,
  ) {
    process.on('message', (msg: any, data: any) => {
      if (typeof msg === 'string') {
        this.emitter.emit(msg, data)
      } else {
        this.emitter.emit(msg.type, msg.data)
      }
    })
  }
  onServiceRegistry(): MessengerService {
    const self = this
    return {
      onMessage(type: string, fn: Fn): void {
        self.emitter.on(type, fn)
      },
      send(type: string, data: any): void {
        const connected = process.connected && process.send
        if (connected) {
          process.send!({ type, data })
        }
      }
    }
  }
}
