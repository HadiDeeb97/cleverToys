/**
 * Reads the pictures in the first sheet of an Excel file (.xlsx), for Admin → Products → Excel import.
 * SheetJS reads the text; this reads the pictures, which it skips. An .xlsx file is a zip of XML files:
 *
 *   - Pictures floating over cells ("Insert → Pictures → Place over Cells", or pasted): drawings
 *     anchored to cells. Each picture belongs to the cell it covers most.
 *   - Pictures inside cells (Excel 365 "Place in Cell", or =IMAGE() pictures saved in the file):
 *     rich values linked to the cell (xl/richData).
 *   - WPS Office cell pictures: =DISPIMG("ID_…") formulas (xl/cellimages.xml).
 *   - =IMAGE("https://…") formulas whose picture isn't saved in the file: the web address is returned.
 *
 * Rows and columns are counted from 0, like SheetJS (row 0 is usually the header row).
 */
import { unzipSync } from 'fflate';

export type SheetPicture = {
  row: number;
  /** Column the picture covers most. */
  col: number;
  /** Every column the picture touches (a floating picture may spill into the next one). */
  cols: number[];
  data?: Uint8Array;
  /** File type from the file name inside the workbook: png, jpeg, gif, emf… */
  type?: string;
  /** For =IMAGE("https://…") without a saved picture. */
  url?: string;
  kind: 'over-cell' | 'in-cell' | 'formula-url';
};

const EMU_PER_PT = 12700;
const EMU_PER_PX = 9525;

const decoder = new TextDecoder();
const parse = (files: Record<string, Uint8Array>, path: string) => {
  const bytes = files[path];
  return bytes ? new DOMParser().parseFromString(decoder.decode(bytes), 'application/xml') : null;
};
/** Elements by local name, whatever their namespace prefix (xdr:, a:, x14: …). */
const all = (root: Document | Element | null | undefined, name: string) => (root ? [...root.getElementsByTagNameNS('*', name)] : []);
const first = (root: Document | Element | null | undefined, name: string) => all(root, name)[0] as Element | undefined;
/** r:id, r:embed… (attribute by local name). */
const relAttr = (el: Element | undefined, name: string) => {
  if (!el) return '';
  for (const attr of [...el.attributes]) if (attr.localName === name) return attr.value;
  return '';
};

/** "../media/image1.png" seen from "xl/drawings/drawing1.xml" → "xl/media/image1.png". */
function resolve(fromFile: string, target: string) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = fromFile.split('/').slice(0, -1);
  for (const piece of target.split('/')) {
    if (piece === '..') parts.pop();
    else if (piece && piece !== '.') parts.push(piece);
  }
  return parts.join('/');
}
const relsPath = (file: string) => { const i = file.lastIndexOf('/'); return `${file.slice(0, i)}/_rels/${file.slice(i + 1)}.rels`; };
/** Relationship id → file path, for one part. */
function relations(files: Record<string, Uint8Array>, file: string) {
  const map = new Map<string, string>();
  for (const rel of all(parse(files, relsPath(file)), 'Relationship')) {
    if (rel.getAttribute('TargetMode') === 'External') continue;
    map.set(rel.getAttribute('Id') || '', resolve(file, rel.getAttribute('Target') || ''));
  }
  return map;
}
/** "E12" → { row: 11, col: 4 }. */
function cellRef(ref: string) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.replace(/\$/g, '').toUpperCase());
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]) - 1, col: col - 1 };
}
const typeOf = (path: string) => (path.split('.').pop() || '').toLowerCase().replace('jpg', 'jpeg');

export function readSheetPictures(buffer: ArrayBuffer): SheetPicture[] {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(new Uint8Array(buffer)); } catch { return []; } // .xls / .csv: no pictures to read
  const out: SheetPicture[] = [];
  const media = (path: string) => (files[path] ? { data: files[path], type: typeOf(path) } : null);

  // The first sheet, as SheetJS reads it.
  const workbookRels = relations(files, 'xl/workbook.xml');
  const sheetPath = workbookRels.get(relAttr(first(parse(files, 'xl/workbook.xml'), 'sheet'), 'id')) || 'xl/worksheets/sheet1.xml';
  const sheet = parse(files, sheetPath);
  if (!sheet) return out;
  const sheetRels = relations(files, sheetPath);

  // Row heights and column widths, to know which cell a floating picture covers most.
  const format = first(sheet, 'sheetFormatPr');
  const defaultRowPt = Number(format?.getAttribute('defaultRowHeight')) || 15;
  const defaultColChars = Number(format?.getAttribute('defaultColWidth')) || (Number(format?.getAttribute('baseColWidth')) || 8) + 0.71;
  const rowPt = new Map<number, number>();
  for (const row of all(sheet, 'row')) {
    const ht = Number(row.getAttribute('ht'));
    if (ht > 0) rowPt.set(Number(row.getAttribute('r')) - 1, ht);
  }
  const colChars: Array<[number, number, number]> = all(sheet, 'col').map((c) => [Number(c.getAttribute('min')) - 1, Number(c.getAttribute('max')) - 1, Number(c.getAttribute('width')) || defaultColChars]);
  const rowEmu = (r: number) => (rowPt.get(r) ?? defaultRowPt) * EMU_PER_PT;
  const colEmu = (c: number) => {
    const chars = colChars.find(([min, max]) => c >= min && c <= max)?.[2] ?? defaultColChars;
    return Math.max(1, Math.round(chars * 7 + 5)) * EMU_PER_PX;
  };

  /** How much of each row (or column) a picture covers, from its start to its end. */
  function coverage(start: number, startOff: number, end: number | null, endOff: number, extent: number, size: (i: number) => number) {
    const spans: Array<[number, number]> = [];
    if (end === null) {
      // Only a start and a size: walk forward until the size is used up.
      let left = extent;
      let i = start;
      let used = Math.min(left, size(i) - startOff);
      spans.push([i, used]);
      left -= used;
      while (left > 0 && spans.length < 200) { i++; used = Math.min(left, size(i)); spans.push([i, used]); left -= used; }
    } else if (end === start) spans.push([start, Math.max(1, endOff - startOff)]);
    else {
      spans.push([start, Math.max(0, size(start) - startOff)]);
      for (let i = start + 1; i < end; i++) spans.push([i, size(i)]);
      spans.push([end, endOff]);
    }
    return spans.filter(([, covered]) => covered > 0);
  }
  const best = (spans: Array<[number, number]>, fallback: number) => spans.reduce((a, b) => (b[1] > a[1] ? b : a), [fallback, -1] as [number, number])[0];

  // ---------- Pictures floating over cells ----------
  for (const drawingEl of all(sheet, 'drawing')) {
    const drawingPath = sheetRels.get(relAttr(drawingEl, 'id'));
    if (!drawingPath) continue;
    const drawing = parse(files, drawingPath);
    const drawingRels = relations(files, drawingPath);
    const anchors = [...all(drawing, 'twoCellAnchor'), ...all(drawing, 'oneCellAnchor')];
    for (const anchor of anchors) {
      const from = first(anchor, 'from');
      if (!from) continue;
      const num = (el: Element | undefined, name: string) => Number(first(el, name)?.textContent || 0);
      const to = anchor.localName === 'twoCellAnchor' ? first(anchor, 'to') : undefined;
      const ext = first(anchor, 'ext');
      const extCx = Number(ext?.getAttribute('cx')) || 0;
      const extCy = Number(ext?.getAttribute('cy')) || 0;
      const rows = coverage(num(from, 'row'), num(from, 'rowOff'), to ? num(to, 'row') : null, to ? num(to, 'rowOff') : 0, extCy, rowEmu);
      const cols = coverage(num(from, 'col'), num(from, 'colOff'), to ? num(to, 'col') : null, to ? num(to, 'colOff') : 0, extCx, colEmu);
      for (const pic of all(anchor, 'pic')) {
        const file = media(drawingRels.get(relAttr(first(pic, 'blip'), 'embed')) || '');
        if (!file) continue;
        out.push({ row: best(rows, num(from, 'row')), col: best(cols, num(from, 'col')), cols: cols.map(([c]) => c), ...file, kind: 'over-cell' });
      }
    }
  }

  // ---------- Pictures inside cells (Excel 365) ----------
  // cell vm="n" → metadata.xml valueMetadata → futureMetadata XLRICHVALUE → rich value → its image.
  const metadata = parse(files, 'xl/metadata.xml');
  const richValues = all(parse(files, 'xl/richData/rdrichvalue.xml'), 'rv');
  const structures = all(parse(files, 'xl/richData/rdrichvaluestructure.xml'), 's');
  const imageRels = all(parse(files, 'xl/richData/richValueRel.xml'), 'rel');
  const richRels = relations(files, 'xl/richData/richValueRel.xml');
  const valueBlocks = all(first(metadata, 'valueMetadata'), 'bk');
  const richBlocks = all(all(metadata, 'futureMetadata').find((f) => f.getAttribute('name') === 'XLRICHVALUE'), 'bk');
  const inCellImage = (vm: number) => {
    const rc = first(valueBlocks[vm - 1], 'rc');
    if (!rc) return null;
    const rvb = first(richBlocks[Number(rc.getAttribute('v'))], 'rvb');
    const rv = richValues[Number(rvb?.getAttribute('i') ?? rc.getAttribute('v'))];
    if (!rv) return null;
    const keys = all(structures[Number(rv.getAttribute('s'))], 'k').map((k) => k.getAttribute('n'));
    const values = all(rv, 'v');
    const at = keys.indexOf('_rvRel:LocalImageIdentifier');
    const relIndex = Number(values[at >= 0 ? at : 0]?.textContent);
    return Number.isInteger(relIndex) ? media(richRels.get(relAttr(imageRels[relIndex], 'id')) || '') : null;
  };

  // ---------- WPS Office cell pictures (=DISPIMG("ID_…")) ----------
  const cellImagesPath = 'xl/cellimages.xml';
  const wpsRels = relations(files, cellImagesPath);
  const wpsImages = new Map<string, { data: Uint8Array; type: string }>();
  for (const pic of all(parse(files, cellImagesPath), 'pic')) {
    const id = first(pic, 'cNvPr')?.getAttribute('name') || '';
    const file = media(wpsRels.get(relAttr(first(pic, 'blip'), 'embed')) || '');
    if (id && file) wpsImages.set(id, file);
  }

  for (const cell of all(sheet, 'c')) {
    const at = cellRef(cell.getAttribute('r') || '');
    if (!at) continue;
    const vm = Number(cell.getAttribute('vm'));
    const formula = first(cell, 'f')?.textContent || '';
    let file = vm > 0 ? inCellImage(vm) : null;
    if (!file && /DISPIMG\(/i.test(formula)) {
      const id = /DISPIMG\(\s*"([^"]+)"/i.exec(formula)?.[1];
      file = id ? wpsImages.get(id) || null : null;
    }
    if (file) { out.push({ row: at.row, col: at.col, cols: [at.col], ...file, kind: 'in-cell' }); continue; }
    const url = /IMAGE\(\s*"(https?:\/\/[^"]+)"/i.exec(formula)?.[1];
    if (url) out.push({ row: at.row, col: at.col, cols: [at.col], url, kind: 'formula-url' });
  }
  return out;
}
