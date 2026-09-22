const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repositoryRoot = path.resolve(__dirname, '..');
const requestedTests = process.argv.slice(2);
const testFiles = requestedTests.length > 0
  ? requestedTests
  : fs.readdirSync(repositoryRoot)
      .filter((name) => /^test-.*\.(?:js|cjs)$/.test(name))
      .sort();

if (testFiles.length === 0) {
  console.error('No test files were found.');
  process.exit(1);
}

const bootstrap = String.raw`
  const fs = require('node:fs');
  const path = require('node:path');
  const Module = require('node:module');

  Module._extensions['.js'] = function compileLegacyJavaScript(module, filename) {
    module._compile(fs.readFileSync(filename, 'utf8'), filename);
  };

  require(path.resolve(process.argv[1]));
`;

const failures = [];

for (const testFile of testFiles) {
  const absoluteTestPath = path.resolve(repositoryRoot, testFile);

  if (!fs.existsSync(absoluteTestPath)) {
    failures.push({ testFile, status: null, reason: 'file not found' });
    continue;
  }

  const result = spawnSync(process.execPath, ['-e', bootstrap, absoluteTestPath], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status === 0) {
    process.stdout.write(`PASS ${testFile}\n`);
    continue;
  }

  const diagnostic = `${result.stdout || ''}${result.stderr || ''}`.trim();
  failures.push({ testFile, status: result.status, reason: diagnostic });
  process.stderr.write(`FAIL ${testFile}\n${diagnostic}\n`);
}

process.stdout.write(`\n${testFiles.length - failures.length}/${testFiles.length} test files passed.\n`);

if (failures.length > 0) {
  process.stderr.write(`${failures.length} test files failed.\n`);
  process.exit(1);
}

