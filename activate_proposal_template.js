/**
 * ACTIVATE SOLUTIONS — PROPOSAL TEMPLATE
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable Node.js script for generating branded .docx proposals.
 *
 * USAGE:
 *   1. Edit the JOB CONFIG section below with your job details.
 *   2. Add/remove pieces in the PIECES array.
 *   3. Run: node activate_proposal_template.js
 *   4. Output: /mnt/user-data/outputs/Activate_Solutions_Proposal.docx
 *
 * REQUIRES:
 *   npm install -g docx
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageNumber, Footer
} = require('docx');
const fs = require('fs');

// ══════════════════════════════════════════════════════════════════════════════
// JOB CONFIG — Edit this section for each new job
// ══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  outputPath: '/mnt/user-data/outputs/Activate_Solutions_Proposal.docx',
  laborRate: 50,          // $/hr — change per job
  phone: '210-296-9294',
};

/**
 * PIECES — Each piece is one section of the proposal.
 *
 * Each piece has:
 *   title       {string}   — Section heading (e.g. "PIECE 1 — Crawl Space Door Repair")
 *   description {string}   — One-sentence scope summary shown under the heading
 *   materials   {Array}    — Array of material line items (see format below)
 *   labor       {Array}    — Array of labor line items (see format below)
 *
 * Line item format: [description, qty, unit, unitPrice, total]
 *   All values are strings. unitPrice and total should include "$".
 *   Units can be: EA, LF, SF, HR, LS, BG, QT, GAL, TU, SET, PR, etc.
 *
 * IMPORTANT: Update materialsSubtotal and laborSubtotal to match your line items.
 */

const PIECES = [
  {
    title: 'PIECE 1 — Side Crawl Space Door Repair & Re-setting (42" x 21.5")',
    description: 'Repair existing crawl space door — replace deteriorated boards, re-level and reset door so it closes properly. Prime and paint to match.',
    materials: [
      ['2x4 PT lumber – frame/sill re-leveling',          '6',  'LF',  '$3.50',  '$21.00'],
      ['1x4 pine boards – door panel replacement',        '2',  'EA',  '$8.00',  '$16.00'],
      ['Exterior wood filler / epoxy consolidant',        '1',  'EA',  '$14.00', '$14.00'],
      ['Exterior wood primer + paint (color match)',      '1',  'QT',  '$18.00', '$18.00'],
      ['Screws, nails, misc fasteners',                   '1',  'LS',  '$6.00',  '$6.00'],
    ],
    materialsSubtotal: 75.00,
    labor: [
      ['Remove & assess door, identify settling issues',  '0.5', 'HR', '$50.00', '$25.00'],
      ['Replace damaged boards on existing door',         '1.0', 'HR', '$50.00', '$50.00'],
      ['Re-level/reset door so it closes properly',      '1.5', 'HR', '$50.00', '$75.00'],
      ['Prime & paint',                                  '0.5', 'HR', '$50.00', '$25.00'],
    ],
    laborSubtotal: 175.00,
  },

  // ── Add more pieces by copying the block above and editing the values ──────
  // {
  //   title: 'PIECE 2 — Example Piece',
  //   description: 'Short description of the scope of work.',
  //   materials: [
  //     ['Material description', 'qty', 'UNIT', '$unitPrice', '$total'],
  //   ],
  //   materialsSubtotal: 0.00,
  //   labor: [
  //     ['Labor task description', 'hrs', 'HR', '$50.00', '$total'],
  //   ],
  //   laborSubtotal: 0.00,
  // },
];

/**
 * OPTIONAL ADD-ON — Leave null to omit from the proposal entirely.
 * Same line item format as pieces above.
 */
const OPTIONAL_ADDON = {
  title: 'OPTIONAL ADD-ON — Full Exterior Paint (All Repaired Areas)',
  description: 'Upgrade to a full prime and paint coat across ALL repaired sections for a uniform finished appearance.',
  items: [
    ['Additional exterior paint (full coverage)',            '1',   'GAL', '$45.00',  '$45.00'],
    ['Primer – additional coverage',                         '1',   'QT',  '$18.00',  '$18.00'],
    ['Labor – full prime & paint all repaired sections',    '3.0',  'HR',  '$50.00',  '$150.00'],
  ],
  total: 213.00,
};
// To omit: const OPTIONAL_ADDON = null;

/**
 * SCOPE NOTES — Shown in the Notes & Terms section.
 * Add, remove, or edit as needed. Each string is one numbered note.
 */
const SCOPE_NOTES = [
  'Siding repair scope assumes damage is limited to the visible section. Any additional hidden damage discovered behind siding will be quoted separately.',
  'Customer to provide or confirm exterior paint color match prior to work start.',
  'Ramp railing labor assumes existing posts are structurally sound. Any post replacement needed will be an additional charge.',
];

// ══════════════════════════════════════════════════════════════════════════════
// BRAND COLORS — Do not change (matches Activate Solutions brand spec)
// ══════════════════════════════════════════════════════════════════════════════

const C = {
  accent:      '1A7FAA',
  headerBg:    '1C1C1C',
  headerText:  '1A7FAA',
  sectionHead: '155F8A',
  rowAlt:      'E0EEF5',
  white:       'FFFFFF',
  subtotalBg:  'F9F9F9',
  totalBg:     '1A7FAA',
  notesBg:     'F9F9F9',
};

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS — Do not edit unless you know what you're doing
// ══════════════════════════════════════════════════════════════════════════════

const cellBorder  = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
const noBorder    = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const allBorders  = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const noBorders   = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

// Column widths (DXA) — Description | Qty | Unit | Unit Price | Total
// Must sum to 9360 (US Letter content width at 1" margins)
const W = [4200, 900, 1000, 1400, 1860];
const COL_HEADERS = ['Description', 'Qty', 'Unit', 'Unit Price', 'Total'];

function spacer(pt = 6) {
  return new Paragraph({ children: [new TextRun('')], spacing: { before: pt * 20, after: 0 } });
}

function sectionHeader(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color: C.sectionHead, font: 'Arial' })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.accent, space: 2 } },
    spacing: { before: 280, after: 120 },
  });
}

function tHeaderRow(cols, widths) {
  return new TableRow({
    tableHeader: true,
    children: cols.map((text, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        borders: allBorders,
        shading: { fill: C.headerBg, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: [new Paragraph({
          alignment: i > 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [new TextRun({ text, bold: true, color: C.headerText, size: 20, font: 'Arial' })]
        })]
      })
    )
  });
}

function tRow(cols, widths, shade = false) {
  const fill = shade ? C.rowAlt : C.white;
  return new TableRow({
    children: cols.map((text, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        borders: allBorders,
        shading: { fill, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          alignment: i > 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [new TextRun({ text: String(text), size: 20, font: 'Arial', color: '1C1C1C' })]
        })]
      })
    )
  });
}

function subtotalRow(label, value, widths) {
  const totalW = widths.reduce((a, b) => a + b, 0);
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: widths.length - 1,
        width: { size: totalW - widths[widths.length - 1], type: WidthType.DXA },
        borders: allBorders,
        shading: { fill: C.subtotalBg, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: label, bold: true, size: 20, font: 'Arial' })]
        })]
      }),
      new TableCell({
        width: { size: widths[widths.length - 1], type: WidthType.DXA },
        borders: allBorders,
        shading: { fill: C.subtotalBg, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: value, bold: true, size: 20, font: 'Arial' })]
        })]
      })
    ]
  });
}

function totalRow(label, value, widths) {
  const totalW = widths.reduce((a, b) => a + b, 0);
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: widths.length - 1,
        width: { size: totalW - widths[widths.length - 1], type: WidthType.DXA },
        borders: allBorders,
        shading: { fill: C.totalBg, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: label, bold: true, size: 22, font: 'Arial', color: C.white })]
        })]
      }),
      new TableCell({
        width: { size: widths[widths.length - 1], type: WidthType.DXA },
        borders: allBorders,
        shading: { fill: C.totalBg, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: value, bold: true, size: 22, font: 'Arial', color: C.white })]
        })]
      })
    ]
  });
}

// Build one piece section (header + description + table)
function buildPieceSection(piece) {
  const pieceTotal = piece.materialsSubtotal + piece.laborSubtotal;
  const elements = [
    spacer(10),
    new Paragraph({ children: [new TextRun({ text: '', size: 4 })] }), // thin divider spacer
    sectionHeader(piece.title),
    new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: piece.description, size: 20, font: 'Arial', color: '444444' })]
    }),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: W,
      rows: [
        tHeaderRow(COL_HEADERS, W),
        ...piece.materials.map((r, i) => tRow(r, W, i % 2 === 1)),
        subtotalRow('Materials Subtotal', `$${piece.materialsSubtotal.toFixed(2)}`, W),
        ...piece.labor.map((r, i) => tRow(r, W, i % 2 === 1)),
        subtotalRow('Labor Subtotal', `$${piece.laborSubtotal.toFixed(2)}`, W),
        totalRow(`${piece.title.split('—')[0].trim()} TOTAL`, `$${pieceTotal.toFixed(2)}`, W),
      ]
    }),
  ];
  return elements;
}

// ══════════════════════════════════════════════════════════════════════════════
// BUILD DOCUMENT
// ══════════════════════════════════════════════════════════════════════════════

const grandTotal = PIECES.reduce((sum, p) => sum + p.materialsSubtotal + p.laborSubtotal, 0);

const docChildren = [

  // ── HEADER ──────────────────────────────────────────────────────────────────
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text: 'ACTIVATE SOLUTIONS', bold: true, size: 52, color: C.accent, font: 'Arial' })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 40 },
    children: [new TextRun({ text: 'Repair & Restoration Proposal', size: 26, color: C.sectionHead, font: 'Arial' })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: C.accent, space: 4 } },
    spacing: { before: 0, after: 200 },
    children: [new TextRun({ text: CONFIG.phone, size: 22, color: '555555', font: 'Arial' })]
  }),

  spacer(4),

  // ── PROJECT INFO ─────────────────────────────────────────────────────────────
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1600, 3080, 1600, 3080],
    borders: { insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE },
               top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
    rows: [
      new TableRow({ children: [
        new TableCell({ borders: noBorders, width: { size: 1600, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: 'Date:', bold: true, size: 20, font: 'Arial' })] })] }),
        new TableCell({ borders: noBorders, width: { size: 3080, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: '___________________', size: 20, font: 'Arial' })] })] }),
        new TableCell({ borders: noBorders, width: { size: 1600, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: 'Proposal #:', bold: true, size: 20, font: 'Arial' })] })] }),
        new TableCell({ borders: noBorders, width: { size: 3080, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: '___________________', size: 20, font: 'Arial' })] })] }),
      ]}),
      new TableRow({ children: [
        new TableCell({ borders: noBorders, width: { size: 1600, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: 'Client:', bold: true, size: 20, font: 'Arial' })] })] }),
        new TableCell({ borders: noBorders, width: { size: 3080, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: '___________________', size: 20, font: 'Arial' })] })] }),
        new TableCell({ borders: noBorders, width: { size: 1600, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: 'Property:', bold: true, size: 20, font: 'Arial' })] })] }),
        new TableCell({ borders: noBorders, width: { size: 3080, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: '___________________', size: 20, font: 'Arial' })] })] }),
      ]}),
    ]
  }),

  // ── PIECES ───────────────────────────────────────────────────────────────────
  ...PIECES.flatMap(piece => buildPieceSection(piece)),

  spacer(14),

  // ── GRAND TOTAL ───────────────────────────────────────────────────────────────
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: W,
    rows: [
      totalRow('TOTAL PROJECT ESTIMATE (All Pieces)', `$${grandTotal.toFixed(2)}`, W),
    ]
  }),

  spacer(14),

  // ── OPTIONAL ADD-ON ───────────────────────────────────────────────────────────
  ...(OPTIONAL_ADDON ? [
    sectionHeader(OPTIONAL_ADDON.title),
    new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: OPTIONAL_ADDON.description, size: 20, font: 'Arial', color: '444444' })]
    }),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: W,
      rows: [
        tHeaderRow(COL_HEADERS, W),
        ...OPTIONAL_ADDON.items.map((r, i) => tRow(r, W, i % 2 === 1)),
        totalRow('OPTIONAL ADD-ON TOTAL', `$${OPTIONAL_ADDON.total.toFixed(2)}`, W),
      ]
    }),
    spacer(14),
  ] : []),

  // ── NOTES & TERMS ─────────────────────────────────────────────────────────────
  sectionHeader('Notes & Terms'),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [
      new TableRow({ children: [
        new TableCell({
          borders: allBorders,
          shading: { fill: C.notesBg, type: ShadingType.CLEAR },
          margins: { top: 120, bottom: 120, left: 180, right: 180 },
          width: { size: 9360, type: WidthType.DXA },
          children: [
            new Paragraph({ spacing: { before: 0, after: 80 }, children: [
              new TextRun({ text: 'Scope Notes', bold: true, size: 20, color: C.sectionHead, font: 'Arial' })
            ]}),
            // Numbered scope notes — generated from SCOPE_NOTES array
            ...SCOPE_NOTES.map((note, i) =>
              new Paragraph({ spacing: { before: 0, after: 60 }, children: [
                new TextRun({ text: `${i + 1}.  ${note}`, size: 20, font: 'Arial' })
              ]})
            ),
            new Paragraph({ spacing: { before: 60, after: 60 }, children: [
              new TextRun({ text: 'Terms', bold: true, size: 20, color: C.sectionHead, font: 'Arial' })
            ]}),
            new Paragraph({ spacing: { before: 0, after: 60 }, children: [
              new TextRun({ text: '50% deposit required to schedule. Balance due upon completion. Quote valid for 30 days. Activate Solutions is not responsible for damage concealed behind existing materials until scope is confirmed on site.', size: 20, font: 'Arial' })
            ]}),
            new Paragraph({ spacing: { before: 80, after: 0 }, children: [
              new TextRun({ text: 'Accepted by: ________________________________   Date: _____________', size: 20, font: 'Arial' })
            ]}),
          ]
        })
      ]}),
    ]
  }),

  spacer(8),
];

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
      }
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 8, color: C.accent, space: 2 } },
            alignment: AlignmentType.CENTER,
            spacing: { before: 80 },
            children: [
              new TextRun({ text: `Activate Solutions  |  ${CONFIG.phone}  |  Page `, size: 18, color: '888888', font: 'Arial' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '888888', font: 'Arial' }),
              new TextRun({ text: ' of ', size: 18, color: '888888', font: 'Arial' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '888888', font: 'Arial' }),
            ]
          })
        ]
      })
    },
    children: docChildren,
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(CONFIG.outputPath, buffer);
  console.log(`✅ Proposal generated: ${CONFIG.outputPath}`);
  console.log(`   Grand total: $${grandTotal.toFixed(2)}`);
  console.log(`   Pieces: ${PIECES.length}`);
}).catch(err => {
  console.error('❌ Error generating proposal:', err);
  process.exit(1);
});
