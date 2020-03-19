// tslint:disable:no-any
import { Application } from '../../../'

export default function configDefault(app: Application): any {
  return {
    connector: {
      port: 8083,
    },
    testConfig: {}
  }
}
