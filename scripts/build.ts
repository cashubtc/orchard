import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Fails the build if any #server/* specifier in the compiled output has no file behind it.
 *
 * Node resolves these through the package.json imports map, which is a literal substitution —
 * a directory target without an explicit /index resolves to nothing and crashes at boot.
 */
function assertServerImportsResolve(): void {
    const offenders: string[] = [];
    for (const entry of readdirSync('dist', { recursive: true, withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
        const file = join(entry.parentPath, entry.name);
        for (const [, target] of readFileSync(file, 'utf8').matchAll(/["']#server\/([^"']+)["']/g)) {
            if (!existsSync(join('dist', `${target}.js`))) offenders.push(`${file}: #server/${target}`);
        }
    }
    if (offenders.length > 0) {
        console.error('Compiled output imports #server/* paths that do not exist in dist.');
        console.error('A directory target needs an explicit /index. Offending specifiers:');
        offenders.forEach((offender) => console.error(`  ${offender}`));
        process.exit(1);
    }
}

const sh = (cmd: string) => () => execSync(cmd, { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });

const steps: { label: string; run: () => void }[] = [
    { label: 'Generating shared types', run: sh('npm run generate:types') },
    { label: 'Building server', run: sh('nest build') },
    { label: 'Checking dist #server imports resolve', run: assertServerImportsResolve },
    { label: 'Building client', run: sh('ng build') },
];

steps.forEach((step) => {
    console.log(`\n${step.label}...`);
    step.run();
});
