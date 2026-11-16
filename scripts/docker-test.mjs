import { spawnSync } from 'node:child_process'

const compose = [
  'compose',
  '-f',
  'docker-compose.yml',
  '-f',
  'docker-compose.test.yml',
  '--profile',
  'test',
  'up',
  '--build',
  '--abort-on-container-exit',
  '--exit-code-from',
]

// --exit-code-from acepta un solo servicio, por eso cada runner va en su propio up.
const runners = ['test-runner', 'frontend-test']

const failed = runners.filter((service) => {
  const { status } = spawnSync('docker', [...compose, service, service], { stdio: 'inherit' })
  return status !== 0
})

if (failed.length > 0) {
  console.error(`\nPruebas fallidas: ${failed.join(', ')}`)
  process.exit(1)
}

console.log(`\nPruebas OK: ${runners.join(', ')}`)
