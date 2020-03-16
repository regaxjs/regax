// tslint:disable:no-any
import { Application } from '../application'
import { PlainData, PlainObject } from '@regax/common'

type UID = string | number // user id
type SID = string // server id

export enum ChannelState {
  INITED,
  CLOSED
}

function deleteFromArr<T>(arr: T[], item: T): void {
  const index = arr.indexOf(item)
  if (index !== -1) arr.splice(index, 1)
}

interface UIDValue {
  uid: UID,
  sid: SID,
  [key: string]: any
}
/**
 * Channel maintains the receiver collection for a subject. You can
 * add users into a channel and then broadcast message to them by channel.
 */
export class Channel {
  protected groups: Map<SID, UID[]> = new Map() // group map for uids. key: serverId, value: [uid]
  protected records: Map<UID, UIDValue> = new Map() // member records. key: uid
  protected values?: { [key: string]: any }
  protected userAmount: number = 0
  protected _state: ChannelState = ChannelState.INITED
  constructor(
    readonly id: string,
    protected channelService: ChannelService,
  ) {}

  /**
   * Add user to channel
   * @param uid
   * @param sid - serverId
   */
  add(uid: UID, sid: SID): boolean {
    if (this._state !== ChannelState.INITED) { return false }
    if (!sid) return false
    let group = this.groups.get(sid)
    if (!group) {
      group = []
      this.groups.set(sid, group)
    }
    if (group.indexOf(uid) !== -1) {
      return false
    }
    group.push(uid)
    this.records.set(uid, {sid: sid, uid: uid})
    this.userAmount++
    return true
  }

  /**
   * Remove user from channel
   * @param uid
   * @param sid
   */
  leave(uid: UID, sid: SID): boolean {
    if (!uid || !sid) return false
    const group = this.groups.get(sid)
    if (!group || group.length === 0) return false
    deleteFromArr(group, uid)
    this.userAmount--
    this.records.delete(uid)
    if (group.length === 0) this.groups.delete(sid)
    if (this.userAmount < 0) this.userAmount = 0
    return true
  }
  /**
   * Get channel UserAmount in a channel.
   */
  get size(): number {
    return this.userAmount
  }
  get state(): ChannelState {
    return this._state
  }
  /**
   * Get channel members.
   * <b>Notice:</b> Heavy operation.
   */
  getMembers(): UID[] {
    const res: UID[] = []
    this.groups.forEach(group => {
      group.forEach(uid => res.push(uid))
    })
    return res
  }
  getValueByUid(uid: UID): UIDValue | undefined {
    return this.records.get(uid)
  }
  setValueByUid(uid: UID, value: PlainObject): void {
    const record = this.records.get(uid)
    Object.assign(record, value)
  }
  setValue(key: string, value: any): void {
    if (!this.values) this.values = {}
    this.values[key] = value
  }
  getValue(key: string): any {
    return this.values ? this.values[key] : undefined
  }
  /**
   * destroy channel.
   */
  destroy(): void {
    this._state = ChannelState.CLOSED
    this.channelService.destroyChannel(this.id)
  }
  /**
   * Push message to all the members in the channel
   * @param route message route
   * @param msg message that would be sent to client
   */
  pushMessage(route: string, msg: PlainData): void {
    if (this.state !== ChannelState.INITED) { return }
    this.channelService.sendMessageByGroup(this.groups, route, msg)
  }
  pushMessageByUids(route: string, msg: PlainData, uids: { uid: UID, sid: SID }[]): void {
    if (this.state !== ChannelState.INITED) { return }
    this.channelService.pushMessageByUids(route, msg, uids)
  }
}

export class ChannelService {
  protected channels: Map<string, Channel> = new Map()
  constructor(protected app: Application) {
  }
  createChannel(channelId: string): Channel {
    let c = this.channels.get(channelId)
    if (c) return c
    c = new Channel(channelId, this)
    this.channels.set(channelId, c)
    return c
  }
  getChannel(channelId: string, create?: boolean): Channel | undefined {
    const c = this.channels.get(channelId)
    if (c) return c
    if (create) {
      return this.createChannel(channelId)
    }
  }
  destroyChannel(channelId: string): void {
    this.channels.delete(channelId)
  }
  /**
   * Push message by uids.
   * Group the uids by group. ignore any uid if sid not specified.
   *
   * @param {String} route message route
   * @param {Object} msg message that would be sent to client
   * @param {Array} uids the receiver info list, [{uid: userId, sid: frontendServerId}]
   * @memberOf ChannelService
   */
  pushMessageByUids(route: string, msg: PlainData, uids: { uid: UID, sid: SID }[]): void {
    if (uids.length === 0) {
      return
    }
    // tslint:disable-next-line:no-any
    const groups = uids.reduce((res: Map<SID, UID[]>, item: any) => {
      if (!res.has(item.sid)) res.set(item.sid, [])
      res.get(item.sid)!.push(item.uid)
      return res
    }, new Map())
    this.sendMessageByGroup(groups, route, msg)
  }
  sendMessageByGroup(groups: Map<SID, UID[]>, route: string, msg: PlainData): void {
    const rpc = this.app.service.rpc
    groups.forEach((uids, serverId) => {
      if (uids.length > 0) {
        rpc.remote(serverId).channel.pushMessage(route, msg, uids)
      }
    })
  }
}
