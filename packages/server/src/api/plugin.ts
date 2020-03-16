export interface PluginOpts {
  name?: string, // the plugin name, it can be used in `dep`
  enable: boolean // whether enabled
  package?: string, // the package name of plugin
  path?: string // the directory of the plugin package
  dependencies?: string[], // the dependent plugins, you can use the plugin name
  env?: string[] // specify the serverEnv that only enable the plugin in it, like ['local', 'unittest' ]
}
