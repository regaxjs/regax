// tslint:disable:no-any
import { Fn, EventEmitter } from '@regax/common'
import { RegaxIPCType } from './ipc'

function sendMessage(msg: any): void {
  const connected = process.connected && process.send
  if (connected) {
    process.send!(msg)
  }
}

export class Messenger {
  protected emitter = new EventEmitter<string>()
  constructor() {
    process.on('message', (data: any) => {
      this.emitter.emit(RegaxIPCType.RESPONSE, data.data)
    })
  }
  on(action: string, fn: Fn): void {
    this.emitter.on(action, fn)
  }
  sendToAgent(action: string, data: any): void {
    sendMessage({ action, data })
  }
}
