// Draws the category pictures in public/category-images/ (emoji illustration on a soft pastel background, 720x900).
// Run: node scripts/category-images.cjs (needs Playwright). Writes PNGs to /tmp/claude-0; convert to WebP before adding.
const pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs = require('fs');
const OUT = '/home/user/cleverToys/public/category-images/';
// slug: [hue, hero, ...small toys]
const CATS = {
  'educational-toys': [205, '🔬', '📚', '🧮', '🔤', '✏️'],
  'baby-toys':        [45,  '🧸', '🍼', '🦆', '🎈', '⭐'],
  'girls-toys':       [330, '🦄', '👑', '🎀', '💖', '✨'],
  'boys-toys':        [215, '🦖', '🚀', '🤖', '⚽', '⚡'],
  'remote-control':   [265, '🏎️', '🎮', '🚁', '📡', '⚡'],
  'games-puzzles':    [150, '🧩', '🎲', '♟️', '🃏', '🎯'],
  'outdoor-toys':     [95,  '🪁', '⚽', '🏀', '🛴', '☀️'],
  'vehicles-cars':    [15,  '🚗', '🚂', '🚒', '🚜', '🚌'],
  'arts-crafts':      [285, '🎨', '✂️', '🖍️', '🖌️', '🌈'],
};
const W = 720, H = 900;
const html = (h, hero, a, b, c, d) => `<!doctype html><html><head><style>
  *{margin:0;box-sizing:border-box}
  body{width:${W}px;height:${H}px;overflow:hidden;font-family:'Noto Color Emoji',sans-serif}
  .bg{position:absolute;inset:0;background:
     radial-gradient(circle at 18% 12%, hsl(${h} 95% 97%) 0 18%, transparent 46%),
     radial-gradient(circle at 85% 90%, hsl(${(h + 40) % 360} 85% 86%) 0 10%, transparent 48%),
     linear-gradient(160deg, hsl(${h} 85% 90%), hsl(${(h + 25) % 360} 80% 82%))}
  .blob{position:absolute;border-radius:50%;background:hsl(${h} 100% 98% / .55)}
  .dot{position:absolute;border-radius:50%}
  .stage{position:absolute;left:50%;top:50%;width:470px;height:470px;transform:translate(-50%,-50%);border-radius:50%;
     background:radial-gradient(circle at 35% 30%, #fff, hsl(${h} 90% 95%) 60%, hsl(${h} 70% 88%));
     box-shadow:0 40px 80px hsl(${h} 50% 40% / .25), inset 0 -18px 40px hsl(${h} 60% 80% / .6)}
  .e{position:absolute;line-height:1;filter:drop-shadow(0 14px 18px hsl(${h} 45% 30% / .28))}
  .hero{left:50%;top:50%;font-size:270px;transform:translate(-50%,-52%) rotate(-6deg);filter:drop-shadow(0 26px 30px hsl(${h} 45% 25% / .35))}
  .a{left:44px;top:70px;font-size:120px;transform:rotate(-14deg)}
  .b{right:46px;top:120px;font-size:108px;transform:rotate(12deg)}
  .c{left:56px;bottom:96px;font-size:112px;transform:rotate(10deg)}
  .d{right:58px;bottom:70px;font-size:120px;transform:rotate(-10deg)}
</style></head><body><div class="bg"></div>
  <div class="blob" style="left:-80px;top:380px;width:260px;height:260px"></div>
  <div class="blob" style="right:-60px;top:-60px;width:240px;height:240px"></div>
  ${[[140, 300, 18, 0], [560, 420, 14, 60], [300, 140, 12, 120], [420, 780, 16, 200], [90, 600, 10, 300], [640, 640, 12, 30], [250, 820, 9, 250], [520, 70, 10, 160]].map(([x, y, s, dh]) => `<div class="dot" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:hsl(${(h + dh) % 360} 80% 62% / .8)"></div>`).join('')}
  <div class="stage"></div>
  <div class="e hero">${hero}</div><div class="e a">${a}</div><div class="e b">${b}</div><div class="e c">${c}</div><div class="e d">${d}</div>
</body></html>`;
(async () => {
  const b = await pw.chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
  for (const [slug, [h, ...e]] of Object.entries(CATS)) {
    await p.setContent(html(h, ...e)); await p.waitForTimeout(150);
    const png = await p.screenshot({ type: 'png' });
    const webp = await p.evaluate(async (b64) => { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()); const c = new OffscreenCanvas(bm.width, bm.height); c.getContext('2d').drawImage(bm, 0, 0); const blob = await c.convertToBlob({ type: 'image/webp', quality: 0.86 }); return Buffer ? null : null; }, png.toString('base64')).catch(() => null);
    fs.writeFileSync(`/tmp/claude-0/${slug}.png`, png);
  }
  await b.close();
})();
