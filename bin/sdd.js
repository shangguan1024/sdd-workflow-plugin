#!/usr/bin/env node

import { Director } from '../dist/director.js'
import { SddState } from '../dist/state.js'

const args = process.argv.slice(2)
const cmd = args[0] || 'help'

async function main() {
  const projectDir = process.cwd()
  const state = new SddState(projectDir)
  await state.load()
  
  const director = new Director(projectDir, state)
  
  const commandArgs = {}
  
  if (cmd === 'gate' && args.length >= 2) {
    commandArgs.phase = parseInt(args[1])
    commandArgs.action = args.length >= 3 ? args[2] : 'check'
    for (let i = 3; i < args.length; i++) {
      if (args[i].startsWith('--')) {
        const key = args[i].slice(2)
        const value = args[i + 1] || 'true'
        commandArgs[key] = value === 'true' ? true : value === 'false' ? false : value
        i++
      }
    }
  } else {
    for (let i = 1; i < args.length; i++) {
      if (args[i].startsWith('--')) {
        const key = args[i].slice(2)
        const value = args[i + 1] || 'true'
        commandArgs[key] = value === 'true' ? true : value
        i++
      } else if (!args[i - 1]?.startsWith('--')) {
        commandArgs.feature = args[i]
      }
    }
  }
  
  const fullCmd = cmd === 'gate' ? `gate ${commandArgs.phase} ${commandArgs.action}` : cmd
  const result = await director.executeCommand(fullCmd, commandArgs)
  
  if (result.success) {
    console.log(`[OK] ${result.message}`)
    if (result.details) {
      result.details.forEach(d => console.log(`   ${d}`))
    }
  } else {
    console.log(`[FAIL] ${result.message}`)
    if (result.details) {
      result.details.forEach(d => console.log(`   ${d}`))
    }
    process.exit(1)
  }
}

function showHelp() {
  console.log(`
SDD-Workflow CLI

Usage: sdd <command> [options]

Commands:
  init              Initialize SDD project
    --template <type>   Project template (standard, rust, python)
    --force             Force reinitialization

  start <feature>   Start new feature (Phase 0)
  resume <feature>  Resume workflow
  status            Show status
    --verbose            Show details
  complete          Complete workflow
  gate <phase> <action>  Gate operations
    action: check, approve, block
  refresh           Context refresh

Examples:
  sdd init
  sdd start user-auth
  sdd status --verbose
  sdd gate 1 check
`)
}

if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
  showHelp()
  process.exit(0)
}

main().catch(err => {
  console.error('[FAIL] Error:', err.message)
  process.exit(1)
})