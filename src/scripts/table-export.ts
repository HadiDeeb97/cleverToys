// Export a table to Excel (.xlsx) or PDF in the browser.
// The libraries are imported on demand so pages only download them when an export is requested.

export type ExportColumn = { header: string; width?: number };
export type ExportCell = string | number | null | undefined;

const xmlEscape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string)
    // Characters XML 1.0 does not allow would make Excel refuse the file.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const columnName = (index: number) => {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
};

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Builds a minimal, valid Office Open XML workbook: bold frozen header row, autofilter and column widths. */
export async function exportXlsx(filename: string, sheetName: string, columns: ExportColumn[], rows: ExportCell[][]) {
  const { zipSync, strToU8 } = await import('fflate');
  const lastCol = columnName(columns.length - 1);
  const cell = (value: ExportCell, ref: string, style = 0) => {
    const s = style ? ` s="${style}"` : '';
    if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${s}><v>${value}</v></c>`;
    const text = String(value ?? '');
    return text ? `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>` : '';
  };
  const header = `<row r="1">${columns.map((c, i) => cell(c.header, `${columnName(i)}1`, 1)).join('')}</row>`;
  const body = rows.map((row, r) => `<row r="${r + 2}">${row.map((v, i) => cell(v, `${columnName(i)}${r + 2}`)).join('')}</row>`).join('');
  const cols = `<cols>${columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 16}" customWidth="1"/>`).join('')}</cols>`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${header}${body}</sheetData><autoFilter ref="A1:${lastCol}${rows.length + 1}"/></worksheet>`;
  const safeSheetName = xmlEscape(sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet1');
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${safeSheetName.replace(/'/g, "''")}'!$A$1:$${lastCol}$${rows.length + 1}</definedName></definedNames></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
    'xl/styles.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'),
    'xl/worksheets/sheet1.xml': strToU8(sheet)
  };
  const zipped = zipSync(files, { level: 6 });
  download(new Blob([zipped], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

/** Landscape A4 PDF with a title block, striped table and page numbers. */
export async function exportPdf(filename: string, title: string, subtitle: string, columns: ExportColumn[], rows: ExportCell[][], accent = '#2563eb') {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const hex = /^#[0-9a-f]{6}$/i.test(accent) ? accent : '#2563eb';
  const rgb: [number, number, number] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  // The built-in PDF fonts only cover Latin-1, so drop emoji and other symbols they cannot draw.
  const pdfText = (value: ExportCell) => String(value ?? '').replace(/[^\u0009\u000A\u000D -ÿ–—‘’“”…]/g, '').trim();
  doc.setFontSize(18);
  doc.setTextColor(27, 21, 48);
  doc.text('Clever Toys', 40, 44);
  doc.setFontSize(12);
  doc.text(pdfText(title), 40, 64);
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 120);
  doc.text(pdfText(subtitle), 40, 80);
  autoTable(doc, {
    startY: 96,
    head: [columns.map((c) => pdfText(c.header))],
    body: rows.map((row) => row.map(pdfText)),
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', textColor: [27, 21, 48] },
    headStyles: { fillColor: rgb, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 246, 251] },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      const page = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 160);
      doc.text(`Page ${page}`, doc.internal.pageSize.getWidth() - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
    }
  });
  download(doc.output('blob'), filename);
}
