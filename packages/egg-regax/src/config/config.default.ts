import { Application, ApplicationOpts } from '@regax/server'

export default function configDefault(app: Application): ApplicationOpts {
  return {
    component: {
      master: ['egg', 'eggMaster'],
      frontend: ['egg'],
      backend: ['egg']
    },
    logger: {
      dir: app.customConfigs.__loggerDir
    }
  }
}
