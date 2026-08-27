const { spawn } = require('child_process');
const proc = spawn('npx', ['drizzle-kit', 'generate', '--config=src/db/drizzle.config.ts']);
proc.stdout.on('data', data => console.log(data.toString()));
proc.stderr.on('data', data => console.error(data.toString()));
