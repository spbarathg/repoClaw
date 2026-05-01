/**
 * @file src/skills/auto_fix.ts
 * Role: Deterministic patch generator mapped directly to error categories.
 */
import { JobState, ErrorCategory, FixStrategyResult } from '../types';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

export const autoFix = async (state: JobState, error: ErrorCategory): Promise<FixStrategyResult> => {
  logger.info(`Skill: auto_fix -> Applying deterministic fix for ${error.category}`);
  
  let patched = false;
  let details = 'No patch strategy applied';

  try {
    switch (error.category) {
      case 'MISSING_ENV': {
        const envPath = path.join(state.sandboxPath, '.env');
        await fs.writeFile(envPath, 'PORT=3000\nDATABASE_URL=mock_url\nAPI_KEY=mock_key\n');
        patched = true;
        details = 'Generated placeholder .env file.';
        break;
      }
      
      case 'MISSING_DEPENDENCY': {
        if (state.stack && error.missingPackageName) {
          const pkgToInstall = error.missingPackageName;
          const pkgManager = state.stack.packageManager;
          const newInstall = pkgManager === 'pip' 
            ? `pip install ${pkgToInstall}` 
            : `${pkgManager} install ${pkgToInstall}`;
          
          state.stack.installCommand = `${state.stack.installCommand} && ${newInstall}`;
          patched = true;
          details = `Appended '${newInstall}' to install phase.`;
        } else {
           details = 'No missingPackageName provided by classifier.';
        }
        break;
      }

      case 'RUNTIME_VERSION_MISMATCH': {
        const pkgJsonPath = path.join(state.sandboxPath, 'package.json');
        try {
          const data = await fs.readFile(pkgJsonPath, 'utf8');
          const pkg = JSON.parse(data);
          if (pkg.engines) {
            delete pkg.engines.node; // strip strict engine reqs
            await fs.writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2));
            patched = true;
            details = 'Removed strict engine requirement from package.json';
          }
        } catch (e) {
          details = 'Failed to parse package.json for version patching';
        }
        break;
      }

      default:
        details = 'Error category is UNKNOWN or lacks an automated patch strategy.';
        break;
    }

    // Write audit patch notes
    if (patched) {
      const patchesDir = path.resolve('./patches');
      await fs.mkdir(patchesDir, { recursive: true });
      const notePath = path.join(patchesDir, `${state.jobId}-fix-${state.retryCount}.md`);
      const noteContent = `# Auto-Fix Audit Log\n\n**Job ID:** ${state.jobId}\n**Retry Cycle:** ${state.retryCount}\n**Category:** ${error.category}\n**Action:** ${details}\n**Probable Cause:** ${error.probableCause}`;
      await fs.writeFile(notePath, noteContent);
    }

  } catch (err: any) {
    logger.error('Skill: auto_fix -> Patching failed', { error: err.message });
    patched = false;
    details = `Patch failure exception: ${err.message}`;
  }

  return { patched, details };
};
