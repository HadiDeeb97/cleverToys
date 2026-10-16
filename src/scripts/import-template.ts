/**
 * The Excel file for Admin → Products → Excel import ("Download Excel template"): a Products sheet
 * with one example row and an Instructions sheet. Rows are tall and picture columns wide, so
 * pictures can be placed in (or over) the image_1…image_5 cells. SheetJS (window.XLSX) writes it.
 * There is no limit on photos: more columns (image_6, image_7…) can be added.
 */
/** image_1 … image_<count>. */
export const imageColumns = (count: number) => Array.from({ length: Math.max(1, count) }, (_, i) => `image_${i + 1}`);
export const IMAGE_COLUMNS = imageColumns(5);

/** The Products sheet's columns, with `images` photo columns (5 in the template; the export adds more when needed). */
export const headersWithImages = (images = 5) => ['name', 'slug', 'sku', 'categories', 'price', 'sale_price', 'cost_price', 'stock_quantity', 'age_min', 'age_max', 'brand', 'short_description', 'description', ...imageColumns(images), 'seo_title', 'seo_description', 'is_active', 'is_featured'];
export const TEMPLATE_HEADERS = headersWithImages(5);

const EXAMPLE = ['Example Toy', 'example-toy', 'CT-001', 'Educational Toys, Outdoor Toys', 9.99, '', 5.5, 10, 3, 8, 'Clever Toys', 'Short description', 'Full description', '', '', '', '', '', 'Example Toy | Clever Toys', 'Shop toys in Lebanon.', true, false];

const PICTURE_HELP = 'Picture: put it INSIDE this cell (Excel: Insert → Pictures → Place in Cell) or OVER this cell (Insert → Pictures → Place over Cells, or paste), or type a web link (https://…): the photo is downloaded and saved in your own storage.';

const INSTRUCTIONS = [
  ['Column', 'Instructions'],
  ['', 'HOW ROWS ARE MATCHED: a row is the toy on your site with the same slug or SKU. A similar name ("Magnetic Tiles 100PCS" / "Magnetic Tiles 100 pcs") is shown as a possible match in the preview, where you choose: update it, skip it, or add it as a new toy.'],
  ['', 'EMPTY CELLS KEEP WHAT THE TOY HAS: for toys already on the site, only filled-in cells change anything. A file with just sku + price updates prices only.'],
  ['name', 'Required for new products. Product name.'],
  ['slug', 'Web address, e.g. piano-game. Empty: made from the name. Products are matched by slug or SKU and updated; new ones are added.'],
  ['sku', 'Optional product code.'],
  ['categories', 'Category names separated by commas, e.g. Educational Toys, Outdoor Toys (must already exist).'],
  ['price', 'Required for new products. Regular price in USD.'],
  ['sale_price', 'Optional sale price in USD. Type none to remove the sale price.'],
  ['cost_price', 'Optional: what one unit costs you (USD), used by Admin → Accounting. Empty keeps the current cost.'],
  ['stock_quantity', 'Available stock. In the preview you can choose to set it to this number or add it to the current stock (a new delivery). (A product with options takes its stock from its options.)'],
  ['age_min / age_max', 'Optional age range, e.g. 3 and 8.'],
  ['brand', 'Optional brand.'],
  ['short_description / description', 'Short and full descriptions.'],
  ['image_1', `MAIN PHOTO. ${PICTURE_HELP}`],
  ['image_2 … image_5', `More photos, shown in this order. ${PICTURE_HELP}`],
  ['image_6, image_7 …', 'As many photos as you want: add more columns named image_6, image_7, image_8… (any number). Several pictures placed over the same cell are all kept too.'],
  ['', 'A row with pictures replaces that product’s photos. A row with no pictures keeps the photos it already has.'],
  ['', 'Pictures are resized and saved as light WebP files. Use PNG or JPG pictures (not EMF or TIFF).'],
  ['seo_title / seo_description', 'Optional text for Google.'],
  ['is_active', 'TRUE (visible in the store) or FALSE (hidden).'],
  ['is_featured', 'TRUE to show on the home page.']
];

export function downloadImportTemplate(XLSX: any) {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, EXAMPLE]);
  ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: IMAGE_COLUMNS.includes(h) ? 16 : Math.max(12, Math.min(32, h.length + 4)) }));
  // Tall rows (about 100 px) so a picture fits inside each image cell.
  ws['!rows'] = [{ hpt: 20 }, ...Array.from({ length: 200 }, () => ({ hpt: 76 }))];
  const wi = XLSX.utils.aoa_to_sheet(INSTRUCTIONS);
  wi['!cols'] = [{ wch: 30 }, { wch: 110 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.utils.book_append_sheet(wb, wi, 'Instructions');
  XLSX.writeFile(wb, 'Clever_Toys_Product_Import_Template.xlsx');
}
