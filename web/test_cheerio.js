const fs = require('fs');
const cheerio = require('cheerio');
const files = fs.readdirSync('.').filter(f => f.startsWith('debug_') && f.endsWith('.html'));
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const $ = cheerio.load(html);
  const p1 = $('[data-testid="address_point_0_address"]').first().text().trim();
  const p2 = $('[data-testid="address_point_1_address"]').first().text().trim();
  
  const rapidoFrom = $(".pickup-point .location").first().text().trim();

  if (p1 || p2) {
    console.log(f, 'Uber: FOUND', '| P1:', p1.substring(0,20));
  } else if (rapidoFrom) {
    console.log(f, 'Rapido: FOUND', '| P1:', rapidoFrom.substring(0,20));
  } else {
    console.log(f, 'MISSING EVERYTHING');
  }
}
