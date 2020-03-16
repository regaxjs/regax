// tslint:disable:no-any

import { inject, injectable } from 'inversify'
import { ObjectOf } from '@regax/common'
export const Component = Symbol('Component')

export {
  injectable,
  inject,
}

export interface Component {
  onLoad?: (componentConfig: ObjectOf<any>) => void // before app start
  onStart?: (componentConfig: ObjectOf<any>) => void | Promise<void> // app start
  onStop?: (componentConfig: ObjectOf<any>) => void | Promise<void> // app stop
  onServiceRegistry?: (componentConfig: ObjectOf<any>) => any // register the service
}

type CompConfig = {
  name: string,
  path: string,
} | string

export interface ComponentOpts<T = CompConfig> {
  master?: T[],
  agent?: T[],
  frontend?: T[],
  backend?: T[],
  all?: T[],
  [specifiedServerType: string]: T[] | undefined,
}
