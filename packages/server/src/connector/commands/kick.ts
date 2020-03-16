import { Package, PackageType } from '@regax/protocol'
import { Command } from './'
import { SocketEvent, Socket } from '../../api'

export class KickCommand implements Command {
  get event(): SocketEvent {
    return SocketEvent.KICK
  }
  handle(socket: Socket, msg: string | number): void {
    // websocket close code 1000 would emit when client close the connection
    if (typeof msg === 'string') {
      const res = {
        reason: msg
      }
      socket.sendRaw(Package.encode(PackageType.KICK, Buffer.from(JSON.stringify(res))))
    }
  }
}
