export interface ParsedReport {
  architecture: string;
  installCmd: string;
  buildCmd: string;
  cycles: Array<{
    cycle: string;
    error: string;
    matchStrength: string;
    strategy: string;
    safety: string;
  }>;
  exitCode: string;
  stderr: string;
  summary: string;
}

export const parseMarkdownReport = (markdown: string | null): ParsedReport => {
  const defaultReport: ParsedReport = {
    architecture: 'UNKNOWN',
    installCmd: 'N/A',
    buildCmd: 'N/A',
    cycles: [],
    exitCode: 'N/A',
    stderr: '',
    summary: 'Awaiting analysis completion.',
  };

  if (!markdown) return defaultReport;

  // Extract Stack
  const stackMatch = markdown.match(/\*\*Stack:\*\*\s*(.+)/);
  if (stackMatch) defaultReport.architecture = stackMatch[1].trim();

  // Extract Commands
  const installMatch = markdown.match(/\*\*Install Command:\*\*\s*`(.+?)`/);
  if (installMatch) defaultReport.installCmd = installMatch[1].trim();

  const buildMatch = markdown.match(/\*\*Build Command:\*\*\s*`(.+?)`/);
  if (buildMatch) defaultReport.buildCmd = buildMatch[1].trim();

  // Extract Repair Trace table rows
  const traceSection = markdown.match(/\| Cycle \| Category \| Match Strength \| Source \| Strategy \| Safety \| Result \|\n\|[-\s|]+\|\n([\s\S]+?)(?:\n---|$)/);
  if (traceSection && traceSection[1]) {
    const rows = traceSection[1].split('\n').filter(line => line.trim().startsWith('|'));
    rows.forEach(row => {
      const parts = row.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 6) {
        defaultReport.cycles.push({
          cycle: parts[0],
          error: parts[1].replace(/`/g, ''),
          matchStrength: parts[2],
          strategy: parts[4] || 'none',
          safety: parts[5] || 'N/A',
        });
      }
    });
  }

  // Extract Exit Code
  const exitMatch = markdown.match(/\*\*Exit Code:\*\*\s*`(.+?)`/);
  if (exitMatch) defaultReport.exitCode = exitMatch[1].trim();

  // Extract STDERR
  const stderrMatch = markdown.match(/#### STDERR\n```\n([\s\S]+?)```/);
  if (stderrMatch) defaultReport.stderr = stderrMatch[1].trim();

  // Extract Summary
  const summaryMatch = markdown.match(/### Summary\n>\s*([\s\S]+?)(?:\n\n|$)/);
  if (summaryMatch) {
    defaultReport.summary = summaryMatch[1].replace(/\n>\s*/g, ' ').trim();
  }

  return defaultReport;
};
