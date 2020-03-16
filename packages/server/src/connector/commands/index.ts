import { PlainData } from '@regax/common'
import { Socket, SocketEvent } from '../../api'

import { HandshakeCommand } from './handshake'
import { HeartbeatCommand } from './heartbeat'
import { KickCommand } from './kick'

export interface Command {
  event: SocketEvent,
  start?: (socket: Socket) => void
  handle?: (socket: Socket, msg: PlainData) => void
}

export const commands = [
  HandshakeCommand,
  HeartbeatCommand,
  KickCommand,
]
