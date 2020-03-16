import { Application, ApplicationOpts } from '@regax/server'

export default function configDefault(app: Application): ApplicationOpts {
  return {
    component: {
      agent: ['logrotator'] // exec in agent
    },
  }
}
