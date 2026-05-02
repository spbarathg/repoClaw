export interface ParsedReport {
  architecture: string;
  installCmd: string;
  buildCmd: string;
  cycles: Array<{
    cycle: string;
    error: string;
    confidence: string;
    patch: string;
  }>;
  exitCode: string;
  stderr: string;
  reasoning: string;
  forensicScore: string;
  scoreGrade: string;
}

export const parseMarkdownReport = (markdown: string | null): ParsedReport => {
  const defaultReport: ParsedReport = {
    architecture: 'UNKNOWN',
    installCmd: 'N/A',
    buildCmd: 'N/A',
    cycles: [],
    exitCode: 'N/A',
    stderr: '',
    reasoning: 'Awaiting analysis completion.',
    forensicScore: 'N/A',
    scoreGrade: '?'
  };

  if (!markdown) return defaultReport;

  // Extract Architecture
  const archMatch = markdown.match(/\*\*Detected Architecture:\*\*\s*(.+)/);
  if (archMatch) defaultReport.architecture = archMatch[1].trim();

  // Extract Commands
  const installMatch = markdown.match(/\*\*Inferred Install:\*\*\s*`(.+?)`/);
  if (installMatch) defaultReport.installCmd = installMatch[1].trim();

  const buildMatch = markdown.match(/\*\*Inferred Build:\*\*\s*`(.+?)`/);
  if (buildMatch) defaultReport.buildCmd = buildMatch[1].trim();

  // Extract Forensic Score
  const scoreMatch = markdown.match(/\*\*Score:\*\*\s*(.+)/);
  if (scoreMatch) defaultReport.forensicScore = scoreMatch[1].trim();
  
  const gradeMatch = markdown.match(/\*\*Grade:\*\*\s*(.+)/);
  if (gradeMatch) defaultReport.scoreGrade = gradeMatch[1].trim();

  // Extract Cycles — match both 5-column and 4-column table formats
  const cyclesSection = markdown.match(/\| Cycle \| Classified Error \| Confidence \| Severity \| Retry Viable \|\n\|[-\s|]+\|\n([\s\S]+?)(?:\n---|\n###|\n####)/) 
    || markdown.match(/\| Cycle \| Classified Error \| Confidence \| Patch Applied \|\n\|[-\s|]+\|\n([\s\S]+?)(?:\n---|\n###|\n####)/);
  if (cyclesSection && cyclesSection[1]) {
    const rows = cyclesSection[1].split('\n').filter(line => line.trim().startsWith('|'));
    rows.forEach(row => {
      const parts = row.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 3) {
        defaultReport.cycles.push({
          cycle: parts[0].replace(/\*\*/g, ''),
          error: parts[1].replace(/`/g, ''),
          confidence: parts[2],
          patch: parts.length >= 5 ? `${parts[3]} | Retry: ${parts[4] || 'N/A'}` : parts[3] || 'N/A'
        });
      }
    });
  }

  // Extract Exit Code
  const exitMatch = markdown.match(/\*\*Container Exit Code:\*\*\s*`(.+?)`/);
  if (exitMatch) defaultReport.exitCode = exitMatch[1].trim();

  // Extract STDERR
  const stderrMatch = markdown.match(/#### `STDERR`\n```bash\n([\s\S]+?)```/);
  if (stderrMatch) defaultReport.stderr = stderrMatch[1].trim();

  // Extract Final Reasoning
  const reasoningMatch = markdown.match(/### 🧠 Final AI Reasoning\n>\s*([\s\S]+?)(?:\n\[|\n$|$)/);
  if (reasoningMatch) {
    defaultReport.reasoning = reasoningMatch[1].replace(/\n>\s*/g, ' ').trim();
  }

  return defaultReport;
};
