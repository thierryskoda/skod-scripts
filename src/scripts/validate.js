const spawn = require('cross-spawn')
const {
  hasScript,
  parseEnv,
  resolveBin,
  getConcurrentlyArgs,
} = require('../utils')

// precommit runs linting and tests on the relevant files
// so those scripts don't need to be run if we're running
// this in the context of a precommit hook.
const precommit = parseEnv('SCRIPTS_PRECOMMIT', false)

const validateScripts = process.argv[3]

const useDefaultScripts = typeof validateScripts !== 'string'

const scripts = useDefaultScripts
  ? Object.entries({
      build: 'npm run build --silent',
      lint: precommit ? null : 'npm run lint --silent',
      flow: 'npm run flow --silent',
    }).reduce(
      (scriptsToRun, [name, script]) => ({
        ...scriptsToRun,
        ...(script && hasScript(name) ? {[name]: script} : null),
      }),
      {},
    )
  : validateScripts.split(',').reduce(
      (scriptsToRun, name) => ({
        ...scriptsToRun,
        [name]: `npm run ${name} --silent`,
      }),
      {},
    )

const result = spawn.sync(
  resolveBin('concurrently'),
  getConcurrentlyArgs(scripts),
  {stdio: 'inherit'},
)

process.exit(result.status)
