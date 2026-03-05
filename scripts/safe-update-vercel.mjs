import { spawn } from 'child_process';
import fs from 'fs';

const envs = {
    NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyDdAplJhqEtgBLLNv3z1jZYI-sDii6pFEM",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "ecossistema-pro-db.firebaseapp.com",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "ecossistema-pro-db",
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "ecossistema-pro-db.firebasestorage.app",
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "522188169576",
    NEXT_PUBLIC_FIREBASE_APP_ID: "1:522188169576:web:9f4d1438d009a5f1feb6dd",
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-75BB3XRS5F"
};

async function execPromise(command) {
    return new Promise((resolve, reject) => {
        const p = spawn(command, { shell: true });
        let out = '';
        p.stdout.on('data', d => out += d);
        p.stderr.on('data', d => out += d);
        p.on('close', code => {
            console.log(out);
            resolve(code);
        });
    });
}

async function addEnv(key, val) {
    return new Promise((resolve) => {
        // We use cmd.exe to prevent powershell newline injection
        // And we avoid echo by creating a temporary file without newlines
        fs.writeFileSync('temp_val.txt', val);

        const p = spawn('cmd.exe', ['/c', `npx vercel env add ${key} production < temp_val.txt`]);
        let output = '';

        p.stdout.on('data', d => {
            const str = d.toString();
            output += str;
            process.stdout.write(str);
            // When it asks to mark as sensitive, we send 'n'
            if (str.includes('sensitive')) {
                p.stdin.write('n\n');
            }
        });

        p.stderr.on('data', d => {
            process.stderr.write(d.toString());
        });

        p.on('close', code => {
            fs.unlinkSync('temp_val.txt');
            resolve(code);
        });
    });
}

async function main() {
    for (const [key, val] of Object.entries(envs)) {
        console.log(`\n--- Removing ${key} ---`);
        await execPromise(`npx vercel env rm ${key} production --yes`);

        console.log(`\n--- Adding ${key} ---`);
        await addEnv(key, val);
    }
    console.log("\nAll done!");
}

main();
