import { execSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/** Fails the build if compiled server output references @server/* — nest build must rewrite alias imports to relative paths. */
function assertNoRuntimeAliasImports(): void {
    const offenders = readdirSync('dist', { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
        .map((entry) => join(entry.parentPath, entry.name))
        .filter((file) => /["']@server\//.test(readFileSync(file, 'utf8')));
    if (offenders.length > 0) {
        console.error('Compiled output references @server/* — nest build normally rewrites these to relative paths.');
        console.error('Check for raw require("@server/...") calls or a build-config regression. Offending files:');
        offenders.forEach((file) => console.error(`  ${file}`));
        process.exit(1);
    }
}

const sh = (cmd: string) => () => execSync(cmd, { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });

const steps: { label: string; run: () => void }[] = [
    { label: 'Generating shared types', run: sh('npm run generate:types') },
    { label: 'Building server', run: sh('nest build') },
    { label: 'Checking dist for runtime @server imports', run: assertNoRuntimeAliasImports },
    { label: 'Building client', run: sh('ng build') },
];

steps.forEach((step) => {
    console.log(`\n${step.label}...`);
    step.run();
});
