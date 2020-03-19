// tslint:disable:no-any

import { Fn } from '@regax/common'

export interface MessengerService {
  onMessage(type: string, fn: Fn): void
  send(type: string, data: any): void
}
