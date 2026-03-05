import { spawn } from 'child_process';

const envs = {
    NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyDdAplJhqEtgBLLNv3z1jZYI-sDii6pFEM",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "ecossistema-pro-db.firebaseapp.com",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "ecossistema-pro-db",
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "ecossistema-pro-db.firebasestorage.app",
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "522188169576",
    NEXT_PUBLIC_FIREBASE_APP_ID: "1:522188169576:web:9f4d1438d009a5f1feb6dd",
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-75BB3XRS5F"
};

async function runCmd(cmd, args, inputLines) {
    return new Promise((resolve) => {
        const p = spawn(cmd, args, { shell: true });
        p.stdout.on('data', d => process.stdout.write(d.toString()));
        p.stderr.on('data', d => process.stderr.write(d.toString()));
        if (inputLines) {
            // Write input with a slight delay to allow prompts to appear
            setTimeout(() => {
                for (const line of inputLines) {
                    p.stdin.write(line + '\n');
                }
                p.stdin.end();
            }, 1000);
        }
        p.on('close', resolve);
    });
}

async function main() {
    for (const [key, val] of Object.entries(envs)) {
        console.log(`\n--- Removing ${key} ---`);
        await runCmd('npx', ['vercel', 'env', 'rm', key, 'production', '--yes']);
        console.log(`\n--- Adding ${key} ---`);
        await runCmd('npx', ['vercel', 'env', 'add', key, 'production'], [val, 'n']);
    }
    console.log("All variables updated successfully!");
}
main();
