// tslint:disable:no-any

// Remote interface
export type Remote<T> = {
  /**
   * @param serverId - server remote address
   */
  readonly [P in keyof T]?: (...args: any[]) => Promise<any>
}
