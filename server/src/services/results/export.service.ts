// src/services/results/export.service.ts
import PDFDocument from 'pdfkit';

import { computeResults, type ElectionResults } from './results.service.js';

// Neutralize spreadsheet formula injection: cells starting with a
// formula-triggering character are prefixed with a single quote.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const csvEscape = (value: number | string): string => {
  let s = String(value);
  if (FORMULA_PREFIX.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportResultsCsv = async (electionId: string): Promise<string> => {
  const results = await computeResults(electionId);
  const rows: string[] = [
    ['Portfolio', 'Candidate', 'Party', 'Votes', 'Percentage'].join(','),
  ];
  for (const portfolio of results.portfolios) {
    for (const candidate of portfolio.candidates) {
      rows.push(
        [
          csvEscape(portfolio.name),
          csvEscape(candidate.name),
          csvEscape(candidate.nickname ?? ''),
          candidate.votes,
          `${candidate.percentage}%`,
        ].join(','),
      );
    }
    rows.push(
      [csvEscape(portfolio.name), 'Skipped', '', portfolio.skip, ''].join(','),
    );
    // An unresolved tie must be visible on the official export, not inferred
    // from two equal rows.
    if (portfolio.isTied) {
      rows.push(
        [
          csvEscape(portfolio.name),
          csvEscape(
            `TIE - no winner: ${portfolio.tiedCandidates.map((c) => c.name).join(' / ')}`,
          ),
          '',
          '',
          '',
        ].join(','),
      );
    }
  }
  rows.push('');
  rows.push(
    `Turnout,${results.turnout.totalVoted}/${results.turnout.totalEligible},${results.turnout.percentage}%`,
  );
  return rows.join('\n');
};

export const exportResultsPdf = async (electionId: string): Promise<Buffer> => {
  const results: ElectionResults = await computeResults(electionId);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => { resolve(Buffer.concat(chunks)); });
    doc.on('error', reject);

    doc.fontSize(20).text(results.election.name, { align: 'center' });
    doc
      .fontSize(10)
      .fillColor('#666')
      .text(
        `Official results${results.election.certifiedAt ? ' (certified)' : ''}`,
        { align: 'center' },
      );
    doc
      .moveDown()
      .fillColor('#000')
      .fontSize(11)
      .text(
        `Turnout: ${results.turnout.totalVoted}/${results.turnout.totalEligible} (${results.turnout.percentage}%)`,
      );

    for (const portfolio of results.portfolios) {
      doc.moveDown().fontSize(14).fillColor('#111').text(portfolio.name);
      doc.fontSize(10).fillColor('#333');
      for (const candidate of portfolio.candidates) {
        doc.text(
          `  ${candidate.name}${candidate.nickname ? ` (${candidate.nickname})` : ''} — ${candidate.votes} votes (${candidate.percentage}%)`,
        );
      }
      if (portfolio.winner) {
        doc.fillColor('#15803d').text(`  Winner: ${portfolio.winner.name}`);
        doc.fillColor('#333');
      } else if (portfolio.isTied) {
        doc
          .fillColor('#b45309')
          .text(
            `  TIE - no winner declared: ${portfolio.tiedCandidates
              .map((c) => c.name)
              .join(' / ')}`,
          );
        doc.fillColor('#333');
      }
    }

    doc.end();
  });
};
