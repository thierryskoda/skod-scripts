const path = require('path')
const fs = require('fs')
const spawn = require('cross-spawn')
const mkdirp = require('mkdirp')
const glob = require('glob')
const rimraf = require('rimraf')
const yargsParser = require('yargs-parser')
const {
  hasFile,
  resolveBin,
  fromRoot,
  getConcurrentlyArgs,
} = require('../../utils')

const crossEnv = resolveBin('cross-env')
const rollup = resolveBin('rollup')
const args = process.argv.slice(2)
const here = p => path.join(__dirname, p)
const parsedArgs = yargsParser(args)

const useBuiltinConfig =
  !args.includes('--config') && !hasFile('rollup.config.js')
const config = useBuiltinConfig
  ? `--config ${here('../../config/rollup.config.js')}`
  : args.includes('--config') ? '' : '--config' // --config will pick up the rollup.config.js file

const environment = parsedArgs.environment
  ? `--environment ${parsedArgs.environment}`
  : ''
const watch = parsedArgs.watch ? '--watch' : ''

let formats = ['esm', 'cjs', 'umd', 'umd.min']

if (typeof parsedArgs.bundle === 'string') {
  formats = parsedArgs.bundle.split(',')
}

const defaultEnv = 'BUILD_ROLLUP=true'

const getCommand = env =>
  [crossEnv, defaultEnv, env, rollup, config, environment, watch]
    .filter(Boolean)
    .join(' ')

const buildPreact = args.includes('--p-react')
const scripts = buildPreact
  ? getPReactScripts()
  : getConcurrentlyArgs(getCommands())

const cleanBuildDirs = !args.includes('--no-clean')

if (cleanBuildDirs) {
  rimraf.sync(fromRoot('dist'))
}

if (buildPreact) {
  if (cleanBuildDirs) {
    rimraf.sync(fromRoot('preact'))
  }
  mkdirp.sync(fromRoot('preact'))
}

const result = spawn.sync(resolveBin('concurrently'), scripts, {
  stdio: 'inherit',
})

if (result.status === 0 && buildPreact && !args.includes('--no-package-json')) {
  const preactPkg = fromRoot('preact/package.json')
  const preactDir = fromRoot('preact')
  const cjsFile = glob.sync(fromRoot('preact/**/*.cjs.js'))[0]
  const esmFile = glob.sync(fromRoot('preact/**/*.esm.js'))[0]
  fs.writeFileSync(
    preactPkg,
    JSON.stringify(
      {
        main: path.relative(preactDir, cjsFile),
        'jsnext:main': path.relative(preactDir, esmFile),
        module: path.relative(preactDir, esmFile),
      },
      null,
      2,
    ),
  )
}

function getPReactScripts() {
  const reactCommands = prefixKeys('react.', getCommands())
  const preactCommands = prefixKeys('preact.', getCommands('BUILD_PREACT=true'))
  return getConcurrentlyArgs(Object.assign(reactCommands, preactCommands))
}

function prefixKeys(prefix, object) {
  return Object.entries(object).reduce((cmds, [key, value]) => ({
    ...cmds,
    [`${prefix}${key}`]: value,
  }), {})
}

function getCommands(env = '') {
  return formats.reduce((cmds, format) => {
    const [formatName, minify = false] = format.split('.')
    const nodeEnv = minify ? 'production' : 'development'
    const buildMinify = Boolean(minify)
    return {
      ...cmds,
      [format]: getCommand(
        `BUILD_FORMAT=${formatName} BUILD_MINIFY=${buildMinify} NODE_ENV=${nodeEnv} ${env}`,
      )
    }
  }, {})
}

process.exit(result.status)
