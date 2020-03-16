import { RPC } from '../../../../../'

export default class ChatRPC extends RPC {
  add(rid: string, uid: string, serverId: string): boolean {
    const channel = this.service.channel.createChannel(rid)
    channel.add(uid, serverId)
    return true
  }
}
