import { SimpleRemoteCache } from '@regax/rpc'

// tslint:disable:no-any
export class TairRemoteCache implements SimpleRemoteCache {
  constructor(
    protected readonly tairAPI: any
  ) {}
  async set(key: string, value: any, exSeconds?: number): Promise<void> {
    await this.tairAPI.put(key, value, {
      expired: exSeconds,
    })
  }
  async get(key: string, exSeconds?: number): Promise<any | undefined> {
    const data = await this.tairAPI.get(key, {
      expired: exSeconds,
    })
    return data.data
  }
  del(key: string): Promise<void> {
    return this.tairAPI.invalid(key)
  }
}
