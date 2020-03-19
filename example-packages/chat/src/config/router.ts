import { Session } from '@regax/server'
const crc = require('crc')

export function chat(servers: string[], session: Session): string {
  if (!session.get('rid')) throw new Error('RoomId miss')
  const index = Math.abs(crc.crc32(session.get('rid'))) % servers.length
  return servers[index]
}
