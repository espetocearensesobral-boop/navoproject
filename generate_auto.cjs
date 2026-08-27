const { spawn } = require('child_process');
const proc = spawn('npx', ['drizzle-kit', 'generate', '--config=src/db/drizzle.config.ts']);
proc.stdout.on('data', (data) => {
    const text = data.toString();
    process.stdout.write(text);
    if (text.includes('?')) {
        // Just send Enter to accept defaults (usually 'Yes' or 'Drop')
        proc.stdin.write('\n');
    }
});
proc.stderr.on('data', (data) => {
    process.stderr.write(data.toString());
});
