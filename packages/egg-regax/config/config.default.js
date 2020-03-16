// Load by egg
module.exports = () => {
  const config = {};

  // This will trigger the egg-logroator
  // TODO test
  config.customLogger = {
    regaxAppLogger: {
      consoleLevel: 'NONE',
      file: 'regax-app.log',
    },
    regaxAgentLogger: {
      consoleLevel: 'NONE',
      file: 'regax-agent.log',
    },
    regaxCoreLogger: {
      consoleLevel: 'NONE',
      file: 'regax-core.log',
    },
  };

  config.regax = {
    agentRPCPort: 4333
  }

  return config;
};
