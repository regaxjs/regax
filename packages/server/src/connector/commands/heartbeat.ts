import { Command } from './'
import { ApplicationOpts, SocketEvent, Socket } from '../../api'
import { Tick } from '@regax/common'
import { Package, PackageType } from '@regax/protocol'

export class HeartbeatCommand implements Command {
  protected clients: { [key: string]: Tick } = {}
  protected heartbeatInterval?: number
  protected heartbeatTimeout?: number
  protected disconnectOnTimeout?: boolean = true
  constructor(
    protected readonly opts: ApplicationOpts['connector'] & {}
  ) {
    if (opts.heartbeatInterval) {
      this.heartbeatInterval = opts.heartbeatInterval
      this.heartbeatTimeout = opts.heartbeatTimeout || this.heartbeatInterval * 2
      this.disconnectOnTimeout = true
    }
  }
  get event(): SocketEvent {
    return SocketEvent.HEARTBEAT
  }
  handle(socket: Socket): void {
    if (!this.heartbeatInterval) return
    if (!this.clients[socket.id]) {
      this.clients[socket.id] = new Tick(this.heartbeatInterval, this.heartbeatTimeout)
      const onClear = () => this.clearClientTick(socket.id)
      socket.once(SocketEvent.DISCONNECT, onClear)
      socket.once(SocketEvent.ERROR, onClear)
    }
    socket.sendRaw(Package.encode(PackageType.HEARTBEAT))
    if (this.disconnectOnTimeout) {
      const tick = this.clients[socket.id]
      tick.stop()
      tick.next(() => {}, () => {
        console.log('client %j heartbeat timeout.', socket.id)
        socket.close()
      })
    }
  }
  clearClientTick(socketId: number): void {
    if (this.clients[socketId]) {
      this.clients[socketId].stop()
      delete this.clients[socketId]
    }
  }
}
