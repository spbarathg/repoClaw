/**
 * @file src/skills/error_classifier.ts
 * Role: Interfaces with AI API; converts raw logs into structured, typed JSON error objects.
 * Architecture: Provider-agnostic AIClassifier interface.
 */
import { ErrorCategory } from '../types';
import { logger } from '../utils/logger';
import { ERROR_CLASSIFICATION_PROMPT } from '../prompts';
import { config } from '../config';
import axios from 'axios';

export interface AIClassifier {
  classifyError(stdout: string, stderr: string): Promise<ErrorCategory>;
}

export class GeminiCompatibleClassifier implements AIClassifier {
  async classifyError(stdout: string, stderr: string): Promise<ErrorCategory> {
    try {
      const promptPayload = `
${ERROR_CLASSIFICATION_PROMPT}

STDOUT:
${stdout.slice(-5000)}

STDERR:
${stderr.slice(-5000)}
      `;

      logger.debug('Sending classification request to Gemini API...');

      if (config.geminiApiKey) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.geminiApiKey}`;
          const response = await axios.post(url, {
            contents: [{ parts: [{ text: promptPayload }] }],
            generationConfig: { responseMimeType: "application/json" }
          });

          if (response.data && response.data.candidates && response.data.candidates[0].content.parts[0].text) {
            const jsonStr = response.data.candidates[0].content.parts[0].text;
            const parsed = JSON.parse(jsonStr);
            logger.info('Successfully classified error via Gemini API');
            return {
              category: parsed.category || 'UNKNOWN',
              severity: parsed.severity || 'high',
              probableCause: parsed.probableCause || 'Unknown',
              confidence: parsed.confidence || 0.5,
              suggestedFix: parsed.suggestedFix || 'Manual check required',
              missingPackageName: parsed.missingPackageName,
              retryRecommended: parsed.retryRecommended ?? false
            };
          }
        } catch (apiErr: any) {
          logger.error('Gemini API call failed, falling back to heuristics', { error: apiErr.message });
        }
      } else {
        logger.warn('No GEMINI_API_KEY found, using heuristic fallback');
      }

      // Fallback Heuristics
      let category: ErrorCategory['category'] = 'UNKNOWN';
      let suggestedFix = 'No clear fix available';
      let probableCause = 'An unknown compilation or execution error occurred.';
      let missingPackageName = '';

      if (stderr.toLowerCase().includes('module not found') || stderr.includes('No module named') || stderr.includes('Cannot find module')) {
        category = 'MISSING_DEPENDENCY';
        probableCause = 'A required package is missing from the dependencies.';
        const match = stderr.match(/Cannot find module '([^']+)'/) || stderr.match(/No module named '?([a-zA-Z0-9_-]+)'?/);
        if (match && match[1]) {
          missingPackageName = match[1];
          suggestedFix = `Install ${match[1]}`;
        } else suggestedFix = 'Install missing dependency identified in logs';
      } else if (stderr.toLowerCase().includes('.env') || stderr.includes('environment variable')) {
        category = 'MISSING_ENV';
        probableCause = 'The application requires a configuration variable that is not set.';
        suggestedFix = 'Generate a .env placeholder file';
      } else if (stderr.toLowerCase().includes('node version') || stderr.includes('engine strict')) {
        category = 'RUNTIME_VERSION_MISMATCH';
        probableCause = 'The package requires a different runtime version.';
        suggestedFix = 'Patch package.json engines block';
      } else if (stderr.toLowerCase().includes('missing script') || stderr.includes('BUILD_SCRIPT_MISSING')) {
        category = 'BUILD_SCRIPT_MISSING';
        probableCause = 'The build script is not defined.';
        suggestedFix = 'Add a default build script';
      }

      return {
        category,
        severity: 'high',
        probableCause,
        confidence: 0.85,
        suggestedFix,
        missingPackageName,
        retryRecommended: true
      };
    } catch (err: any) {
      logger.error('AI Classification API completely failed', { error: err.message });
      return {
        category: 'UNKNOWN',
        severity: 'medium',
        probableCause: 'AI Provider failed to classify',
        confidence: 0,
        suggestedFix: 'Manual intervention required',
        retryRecommended: false
      };
    }
  }
}

export const errorClassifier = async (stdout: string, stderr: string): Promise<ErrorCategory> => {
  logger.info('Skill: error_classifier -> Classifying build failure');
  const classifier = new GeminiCompatibleClassifier();
  return await classifier.classifyError(stdout, stderr);
};
