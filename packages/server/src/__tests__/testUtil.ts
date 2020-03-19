// tslint:disable:no-any
import * as expect from 'expect'
import * as path from 'path'
import { Fn } from '@regax/common'
import { Application } from '../'

export async function expectThrow(fn: Fn, msg: string | RegExp): Promise<void> {
  let error: Error
  try {
    await fn()
  } catch (e) {
    error = e
  }
  expect(error!).toBeDefined()
  expect(error!.message).toMatch(msg)
}

export function createTestApp(serverType: string = 'master'): Application {
  return new Application(
    path.join(__dirname, '../../lib/__tests__/template'),
    serverType,
  )
}
