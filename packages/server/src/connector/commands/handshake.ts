
import { Command } from './'
import { Package, PackageType } from '@regax/protocol'
import { PlainData } from '@regax/common'
import { ApplicationOpts, SocketEvent, Socket } from '../../api'

export type HandshakeBuffer = {
  sys: {
    type: string,
    version: string,
    rsa?: {
      rsa_n?: string | number,
      rsa_e?: string | number,
    },
    heartbeat?: number
  },
  user: PlainData,
} & PlainData

enum HandshakeCode {
  OK = 200,
  USER_ERROR = 500,
  OLD_CLIENT = 501
}

export class HandshakeCommand implements Command {
  constructor(
    protected readonly opts: ApplicationOpts['connector'] & {}
  ) { }
  get event(): SocketEvent {
    return SocketEvent.HANDSHAKE
  }
  async handle(socket: Socket, msg: HandshakeBuffer): Promise<void> {
    let user
    if (!msg.sys) {
      processError(socket, HandshakeCode.USER_ERROR)
      return
    }
    if (typeof this.opts.checkClient === 'function') {
      if (!this.opts.checkClient(msg.sys.type, msg.sys.version)) {
        processError(socket, HandshakeCode.OLD_CLIENT)
        return
      }
    }
    if (typeof this.opts.userHandshake === 'function') {
      try {
        user = await this.opts.userHandshake(msg.user)
      } catch (e) {
        processError(socket, HandshakeCode.USER_ERROR, e.message)
        return
      }
    }
    const sys = {
      heartbeat: this.opts.heartbeatInterval ? this.opts.heartbeatInterval : undefined,
    }
    // TODO crypto and protobuf
    response(socket, sys, user)
  }
}

function response(socket: Socket, sys: PlainData, user?: PlainData): void {
  const res: PlainData = {
    code: HandshakeCode.OK,
    sys,
  }
  if (user) {
    res.user = user
  }
  socket.handshakeResponse(Package.encode(PackageType.HANDSHAKE, Buffer.from(JSON.stringify(res))))
}

function processError(socket: Socket, code: number, error?: string): void {
  const res = {
    code: code,
    message: error,
  }
  socket.sendForce(Package.encode(PackageType.HANDSHAKE, Buffer.from(JSON.stringify(res))))
  process.nextTick(() => {
    socket.close()
  })
}
