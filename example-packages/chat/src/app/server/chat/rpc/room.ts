import { RPC } from '@regax/server'

export default class ChatRPC extends RPC {
  add(uid: string, serverId: string, rid: string): void {
    const channel = this.service.channel.createChannel(rid)
    channel.add(uid, serverId)
  }
}
