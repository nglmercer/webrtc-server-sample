#!/usr/bin/env bun

// Example test runner script for WebRTC Socket API
// This demonstrates how to run the test suite and provides examples of usage

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const TEST_CONFIG = {
  patterns: {
    unit: 'tests/unit/*.test.ts',
    integration: 'tests/integration/*.test.ts',
    all: 'tests/**/*.test.ts',
    signaling: '**/*signaling*.test.ts',
    performance: '**/*performance*.test.ts'
  },
  options: {
    coverage: '--coverage',
    watch: '--watch',
    verbose: 'VERBOSE=true',
    timeout: 'TEST_TIMEOUT=10000'
  }
};

// Color output utilities
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// Banner
console.log(colorize(`
╔══════════════════════════════════════════════════════════════╗
║                    WebRTC Socket API Test Runner                ║
║                                                              ║
║  Bun-powered testing suite for WebRTC signaling server        ║
╚══════════════════════════════════════════════════════════════╝
`, 'cyan'));

// Utility functions
function runCommand(command: string, args: string[], description: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(colorize(`\n🚀 ${description}`, 'yellow'));
    console.log(colorize(`Command: ${command} ${args.join(' ')}`, 'blue'));

    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd: join(__dirname, '..')
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(colorize(`✅ ${description} completed successfully`, 'green'));
        resolve();
      } else {
        console.log(colorize(`❌ ${description} failed with code ${code}`, 'red'));
        reject(new Error(`${description} failed`));
      }
    });

    child.on('error', (error) => {
      console.log(colorize(`💥 Error running ${description}: ${error.message}`, 'red'));
      reject(error);
    });
  });
}

function checkPrerequisites(): void {
  console.log(colorize('\n📋 Checking prerequisites...', 'magenta'));

  // Check if bun is available
  try {
    spawn('bun', ['--version'], { stdio: 'pipe', shell: true });
    console.log(colorize('✅ Bun is available', 'green'));
  } catch (error) {
    console.log(colorize('❌ Bun is not installed or not in PATH', 'red'));
    console.log(colorize('Please install Bun: curl -fsSL https://bun.sh/install | bash', 'yellow'));
    process.exit(1);
  }

  // Check if test files exist
  const testDir = join(__dirname, '..');
  const unitTests = existsSync(join(testDir, 'unit'));
  const integrationTests = existsSync(join(testDir, 'integration'));

  if (unitTests) {
    console.log(colorize('✅ Unit tests directory found', 'green'));
  } else {
    console.log(colorize('⚠️  Unit tests directory not found', 'yellow'));
  }

  if (integrationTests) {
    console.log(colorize('✅ Integration tests directory found', 'green'));
  } else {
    console.log(colorize('⚠️  Integration tests directory not found', 'yellow'));
  }
}

// Test runners
async function runUnitTests(): Promise<void> {
  await runCommand(
    'bun',
    ['test', TEST_CONFIG.patterns.unit],
    'Unit Tests'
  );
}

async function runIntegrationTests(): Promise<void> {
  await runCommand(
    'bun',
    ['test', TEST_CONFIG.patterns.integration],
    'Integration Tests'
  );
}

async function runAllTests(): Promise<void> {
  await runCommand(
    'bun',
    ['test', TEST_CONFIG.patterns.all],
    'All Tests'
  );
}

async function runTestsCoverage(): Promise<void> {
  await runCommand(
    'bun',
    ['test', TEST_CONFIG.patterns.all, TEST_CONFIG.options.coverage],
    'Tests with Coverage'
  );
}

async function runTestsWatch(): Promise<void> {
  await runCommand(
    'bun',
    ['test', TEST_CONFIG.patterns.all, TEST_CONFIG.options.watch],
    'Tests in Watch Mode'
  );
}

async function runSignalingTests(): Promise<void> {
  await runCommand(
    'bun',
    ['test', TEST_CONFIG.patterns.signaling],
    'Signaling Server Tests'
  );
}

async function runPerformanceTests(): Promise<void> {
  await runCommand(
    'bun',
    ['test', TEST_CONFIG.patterns.performance],
    'Performance Tests'
  );
}

async function runVerboseTests(): Promise<void> {
  await runCommand(
    'bash',
    ['-c', `${TEST_CONFIG.options.verbose} bun test ${TEST_CONFIG.patterns.all}`],
    'Verbose Tests'
  );
}

// Menu system
function showMenu(): void {
  console.log(colorize('\n📋 Select test option:', 'bright'));
  console.log(colorize('1. Run all tests', 'cyan'));
  console.log(colorize('2. Run unit tests only', 'cyan'));
  console.log(colorize('3. Run integration tests only', 'cyan'));
  console.log(colorize('4. Run tests with coverage', 'cyan'));
  console.log(colorize('5. Run tests in watch mode', 'cyan'));
  console.log(colorize('6. Run signaling server tests only', 'cyan'));
  console.log(colorize('7. Run performance tests only', 'cyan'));
  console.log(colorize('8. Run tests with verbose output', 'cyan'));
  console.log(colorize('9. Run quick tests (unit + signaling)', 'cyan'));
  console.log(colorize('0. Exit', 'red'));
  console.log(colorize('\nEnter your choice (0-9):', 'yellow'));
}

// Quick test runner for CI
async function runQuickTests(): Promise<void> {
  console.log(colorize('\n🏃‍♂️ Running quick tests...', 'yellow'));

  await runCommand(
    'bun',
    ['test', 'tests/unit/signaling-server.test.ts', 'tests/unit/room-handlers.test.ts'],
    'Quick Core Tests'
  );
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle command line arguments
  if (args.length > 0) {
    const option = args[0];

    switch (option) {
      case 'all':
        await runAllTests();
        break;
      case 'unit':
        await runUnitTests();
        break;
      case 'integration':
        await runIntegrationTests();
        break;
      case 'coverage':
        await runTestsCoverage();
        break;
      case 'watch':
        await runTestsWatch();
        break;
      case 'signaling':
        await runSignalingTests();
        break;
      case 'performance':
        await runPerformanceTests();
        break;
      case 'verbose':
        await runVerboseTests();
        break;
      case 'quick':
        await runQuickTests();
        break;
      case 'help':
        console.log(colorize('\n📖 Usage:', 'bright'));
        console.log('bun run-tests.example.ts [option]');
        console.log('\nOptions:');
        console.log('  all         - Run all tests');
        console.log('  unit        - Run unit tests only');
        console.log('  integration - Run integration tests only');
        console.log('  coverage    - Run tests with coverage');
        console.log('  watch       - Run tests in watch mode');
        console.log('  signaling   - Run signaling server tests');
        console.log('  performance - Run performance tests');
        console.log('  verbose     - Run tests with verbose output');
        console.log('  quick       - Run quick tests (CI)');
        console.log('  help        - Show this help');
        break;
      default:
        console.log(colorize(`❌ Unknown option: ${option}`, 'red'));
        console.log(colorize('Use "help" to see available options', 'yellow'));
        process.exit(1);
    }

    return;
  }

  // Interactive mode
  checkPrerequisites();

  // Read user input
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  while (true) {
    showMenu();

    const choice = await question('');

    try {
      switch (choice) {
        case '1':
          await runAllTests();
          break;
        case '2':
          await runUnitTests();
          break;
        case '3':
          await runIntegrationTests();
          break;
        case '4':
          await runTestsCoverage();
          break;
        case '5':
          await runTestsWatch();
          break;
        case '6':
          await runSignalingTests();
          break;
        case '7':
          await runPerformanceTests();
          break;
        case '8':
          await runVerboseTests();
          break;
        case '9':
          await runQuickTests();
          break;
        case '0':
          console.log(colorize('\n👋 Goodbye!', 'green'));
          rl.close();
          process.exit(0);
        default:
          console.log(colorize('❌ Invalid choice. Please try again.', 'red'));
      }
    } catch (error) {
      console.log(colorize(`💥 Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'red'));
    }

    console.log(colorize('\n⏸️  Press Enter to continue...', 'yellow'));
    await question('');
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log(colorize('\n\n🛑 Test runner interrupted', 'yellow'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(colorize('\n\n🛑 Test runner terminated', 'yellow'));
  process.exit(0);
});

// Run main function
if (import.meta.main) {
  main().catch((error) => {
    console.log(colorize(`💥 Fatal error: ${error.message}`, 'red'));
    process.exit(1);
  });
}

export {
  runUnitTests,
  runIntegrationTests,
  runAllTests,
  runTestsCoverage,
  runTestsWatch,
  runSignalingTests,
  runPerformanceTests,
  runVerboseTests,
  runQuickTests
};
