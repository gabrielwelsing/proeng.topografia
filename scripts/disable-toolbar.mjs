import { spawn } from 'child_process';
import fs from 'fs';

async function addEnv(key, val, envName) {
    return new Promise((resolve) => {
        fs.writeFileSync('temp_val.txt', val);
        const p = spawn('cmd.exe', ['/c', `npx vercel env add ${key} ${envName} < temp_val.txt`]);
        p.stdout.on('data', d => {
            const str = d.toString();
            process.stdout.write(str);
            if (str.includes('sensitive')) p.stdin.write('n\n');
        });
        p.stderr.on('data', d => process.stderr.write(d.toString()));
        p.on('close', code => resolve(code));
    });
}

async function main() {
    console.log("Adding VERCEL_TOOLBAR=false to production");
    await addEnv('VERCEL_TOOLBAR', 'false', 'production');
    console.log("Adding VERCEL_TOOLBAR=false to preview");
    await addEnv('VERCEL_TOOLBAR', 'false', 'preview');
    fs.unlinkSync('temp_val.txt');
    console.log("Done");
}

main();
