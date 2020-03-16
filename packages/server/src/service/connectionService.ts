import { values } from '@regax/common'
import { Application } from '../application'

export interface ConnectionLoginInfo {
  loginTime: number,
  uid: number | string
  address: string
}

export interface ConnectionStatisticsInfo {
  serverId: string,
  loginedCount: number,
  totalConnCount: number,
  loginedList: ConnectionLoginInfo[]
}

/**
 * connection statistics service
 * record connection, login count and list
 */
export class ConnectionService {
  protected loginedCount = 0 // login count
  protected connCount = 0 // connection count
  protected logined: { [uid: string]: ConnectionLoginInfo } = {}
  constructor(
    protected app: Application
  ) {
  }
  get totalConnCount(): number {
    return this.connCount
  }
  /**
   * Add logined user
   * @param uid  user id
   * @param info record for logined user
   */
  addLoginedUser(uid: string | number, info: ConnectionLoginInfo): void {
    if (!this.logined[uid]) {
      this.loginedCount ++
    }
    this.logined[uid] = { ...info, uid }
  }
  /**
   * Update user info.
   * @param uid user id
   * @param info info for update.
   */
  updateUserInfo(uid: string | number, info: {}): void {
    const user = this.logined[uid]
    if (!user) return
    this.logined[uid] = { ...user, ...info }
  }

  /**
   * @param uid user id
   */
  removeLoginedUser(uid: string | number): void {
    if (this.logined[uid]) {
      this.loginedCount --
    }
    delete this.logined[uid]
  }
  /**
   * Increase connection count
   */
  increaseConnectionCount(): void {
    this.connCount++
  }
  decreaseConnectionCount(uid?: string | number): void {
    if (this.connCount) {
      this.connCount --
    }
    if (uid) {
      this.removeLoginedUser(uid)
    }
  }
  /**
   * Get statistics info
   */
  getStatisticsInfo(): ConnectionStatisticsInfo {
    return {
      serverId: this.app.serverId,
      loginedCount: this.loginedCount,
      totalConnCount: this.connCount,
      loginedList: values(this.logined)
    }
  }
}
