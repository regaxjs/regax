import { Application as RegaxApplication } from '@regax/server'

declare module 'egg' {
  export interface Application {
    regax: RegaxApplication;
  }
}
