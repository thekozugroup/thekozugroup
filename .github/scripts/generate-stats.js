/**
 * Ghost — profile stat cards for thekozugroup.
 *
 * A monochrome, editorial, retro-gaming stat system rendered as self-contained
 * animated SVG. Follows the Ghost design language: pure-white canvas, near-black
 * ink, a four-step neutral-gray ramp, hairline borders, sharp square content vs.
 * rounded pill chrome, a pixel-art ghost mascot as the sole brand mark, and one
 * ambient animation (the mascot bob). Color comes only from data — the chrome is
 * strictly monochrome. Motion is CSS-only and settles under prefers-reduced-motion.
 *
 * Render functions are pure (data in, SVG string out) and exported so the same
 * code path can render live (in CI, with a token) or from a snapshot.
 */
const fs = require('fs');

const USERNAME = process.env.GITHUB_USERNAME || 'thekozugroup';
const TOKEN = process.env.GITHUB_TOKEN;

// ─── Ghost design tokens ───────────────────────────────────────────────────
const SURFACE = '#ffffff'; // canvas
const INK = '#111111'; // on-surface — headings / primary
const CHARCOAL = '#2a2a2a'; // neutral-90
const GRAY_DARK = '#333333'; // neutral-70
const GRAY_MID = '#555555'; // neutral-50 — body
const GRAY_LIGHT = '#777777'; // neutral-40 — muted / captions
const BORDER = '#dddddd'; // neutral-20 — hairline
const STONE = '#f7f4ef'; // warm off-white accent (sparingly)

// Monochrome data ramps (data carries the only "color").
const BAR_RAMP = ['#161616', '#2a2a2a', '#3d3d3d', '#565656', '#6f6f6f', '#8a8a8a', '#a3a3a3', '#bdbdbd'];
const HEAT_RAMP = ['#ededed', '#c6c6c6', '#8f8f8f', '#4d4d4d', '#161616'];

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'DejaVu Sans Mono',monospace";

const PAD = 28;
const H_HALF = 280; // shared height for the two side-by-side data cards

// ─── 5×7 pixel digit font (retro score-counter numerals) ────────────────────
const FONT5x7 = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};

function pixelDigits(text, x, y, cell, color, cls) {
  let out = '';
  let cx = x;
  for (const ch of String(text)) {
    if (ch === ' ') { cx += cell * 3; continue; }
    const glyph = FONT5x7[ch];
    if (!glyph) { cx += cell * 6; continue; }
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (glyph[r][c] === '1') {
          out += `<rect x="${(cx + c * cell).toFixed(1)}" y="${(y + r * cell).toFixed(1)}" width="${cell}" height="${cell}"/>`;
        }
      }
    }
    cx += cell * 6; // 5 wide + 1 gap
  }
  const width = cx - x - cell;
  const g = `<g class="${cls || ''}" fill="${color}">${out}</g>`;
  return { svg: g, width };
}

function pixelWidth(text, cell) {
  let w = 0;
  for (const ch of String(text)) w += ch === ' ' ? cell * 3 : cell * 6;
  return w - cell;
}

// ─── Kozu brand mark (the "K" monogram, sole brand mark) ────────────────────
// Native artwork is authored on a 500×500 grid; bounding box is x[129.47,370.52]
// y[0,500] — tall and narrow (≈241×500). We centre + scale it into the header.
const LOGO_PATH =
  'M129.47,0v500h64.28v-128.05c0-11.45,13.85-17.19,21.95-9.09l109.37,109.37,45.45-45.45-167.69-167.69c-5.02-5.02-5.02-13.16,0-18.18l167.69-167.69-45.45-45.45-109.37,109.37c-8.1,8.1-21.95,2.36-21.95-9.09V0h-64.28Z';
const LOGO_BBOX = { x: 129.47, y: 0, w: 241.05, h: 500 };

function logoMark(centerX, centerY, targetH) {
  const scale = targetH / LOGO_BBOX.h;
  const bw = LOGO_BBOX.w * scale;
  const bh = LOGO_BBOX.h * scale;
  const left = centerX - bw / 2;
  const top = centerY - bh / 2;
  const tx = left - LOGO_BBOX.x * scale;
  const shadow = `<ellipse class="mshadow" cx="${centerX}" cy="${(top + bh + 9).toFixed(2)}" rx="${(bw * 0.62).toFixed(2)}" ry="${(targetH * 0.055).toFixed(2)}" fill="${INK}" opacity="0.12"/>`;
  // Outer group carries the float animation (CSS transform); inner group carries
  // the static translate/scale so the two transforms don't collide.
  const mark = `<g class="mark"><g transform="translate(${tx.toFixed(2)},${top.toFixed(2)}) scale(${scale.toFixed(4)})"><path d="${LOGO_PATH}" fill="${INK}"/></g></g>`;
  return shadow + mark;
}

// ─── Shared animation CSS ───────────────────────────────────────────────────
const ANIM_CSS = `
  text{font-family:${SANS};}
  .mono{font-family:${MONO};}
  .mark{transform-box:fill-box;transform-origin:center;animation:bob 3s ease-in-out infinite;}
  .mshadow{transform-box:fill-box;transform-origin:center;animation:shadowpulse 3s ease-in-out infinite;}
  @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  @keyframes shadowpulse{0%,100%{transform:scaleX(1);opacity:.12}50%{transform:scaleX(.72);opacity:.06}}
  .bar{transform-box:fill-box;transform-origin:left center;animation:grow .9s cubic-bezier(.4,0,.2,1) both;}
  @keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
  .cell{animation:fade .5s ease-out both;}
  @keyframes fade{from{opacity:0}to{opacity:1}}
  .pix{transform-box:fill-box;transform-origin:center;animation:pop .5s ease-out both;}
  @keyframes pop{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
  .spark{stroke-dasharray:1600;stroke-dashoffset:0;animation:draw 1.8s ease-out both;}
  @keyframes draw{from{stroke-dashoffset:1600}to{stroke-dashoffset:0}}
  .sparkfill{animation:fade 1.8s ease-out both;}
  @media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

// Open an SVG document (no card frame drawn — callers add cardRect/panels).
function svgHead(w, h, extraStyle = '') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img">
<style>${ANIM_CSS}${extraStyle}</style>`;
}

// A flat white card with a hairline border and sharp square corners.
function cardRect(x, y, w, h) {
  return `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" fill="${SURFACE}" stroke="${BORDER}" stroke-width="1"/>`;
}

// Single-card document (frame + open) for a full card at the origin.
function svgOpen(w, h, extraStyle = '') {
  return svgHead(w, h, extraStyle) + cardRect(0, 0, w, h);
}

// Standard card header: mono eyebrow "NN / TITLE" + hairline divider.
function cardHeader(w, index, title) {
  return `<text class="mono" x="${PAD}" y="${PAD + 4}" font-size="12" letter-spacing="2" fill="${GRAY_LIGHT}">${index}</text>
<text class="mono" x="${PAD + 30}" y="${PAD + 4}" font-size="12" letter-spacing="2" fill="${INK}">${title}</text>
<line x1="${PAD}" y1="${PAD + 16}" x2="${w - PAD}" y2="${PAD + 16}" stroke="${BORDER}" stroke-width="1"/>`;
}

// ─── Nav pill (rounded chrome vs. square content) ───────────────────────────
function navPill(x, y, items, activeIdx) {
  const fs = 11;
  const cw = 6.9; // approx mono char advance at 11px
  const ls = 1.2;
  const gap = 18;
  const padX = 16;
  const height = 30;
  let inner = 0;
  const widths = items.map((it) => it.length * (cw + ls));
  inner = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  const pillW = inner + padX * 2;
  let out = `<rect x="${x}" y="${y}" width="${pillW}" height="${height}" rx="${height / 2}" fill="${SURFACE}" stroke="${BORDER}" stroke-width="1"/>`;
  let tx = x + padX;
  const ty = y + height / 2 + fs / 2 - 1.5;
  items.forEach((label, i) => {
    const active = i === activeIdx;
    out += `<text class="mono" x="${tx}" y="${ty}" font-size="${fs}" letter-spacing="${ls}" fill="${active ? INK : GRAY_LIGHT}">${label}</text>`;
    if (active) {
      out += `<rect x="${tx - 1}" y="${y + height - 6}" width="${widths[i]}" height="1.5" fill="${INK}"/>`;
    }
    tx += widths[i] + gap;
  });
  return { svg: out, width: pillW };
}

// ─── Header / hero card ─────────────────────────────────────────────────────
function renderHeader(summary) {
  const w = 900;
  const h = 232;
  let s = svgOpen(w, h);

  // Brand mark (the floating Kozu "K"), left.
  const markCenterX = 76;
  const markCenterY = 72;
  s += logoMark(markCenterX, markCenterY, 84);

  // Wordmark + tagline.
  const tx = 150;
  s += `<text class="mono" x="${tx}" y="78" font-size="34" font-weight="600" letter-spacing="1.5" fill="${INK}">THE KOZU GROUP</text>`;
  s += `<text x="${tx + 2}" y="104" font-size="14.5" fill="${GRAY_MID}">Building in the open. Read it. Fork it. Ship it.</text>`;

  // Nav pill.
  const nav = navPill(tx, 122, ['OVERVIEW', 'LANGUAGES', 'ACTIVITY', 'SOURCE'], 0);
  s += nav.svg;

  // Bottom stat strip.
  const stripY = 172;
  s += `<line x1="${PAD}" y1="${stripY}" x2="${w - PAD}" y2="${stripY}" stroke="${BORDER}" stroke-width="1"/>`;
  const stats = [
    { label: 'FOLLOWERS', value: summary.followers },
    { label: 'STARS', value: summary.stars },
    { label: 'FORKS', value: summary.forks },
    { label: 'REPOSITORIES', value: summary.repos },
  ];
  const colW = (w - PAD * 2) / stats.length;
  stats.forEach((st, i) => {
    const cx = PAD + colW * i;
    if (i > 0) s += `<line x1="${cx}" y1="${stripY + 12}" x2="${cx}" y2="${stripY + 44}" stroke="${BORDER}" stroke-width="1"/>`;
    s += `<text class="mono" x="${cx + 20}" y="${stripY + 34}" font-size="26" font-weight="600" fill="${INK}">${st.value}</text>`;
    s += `<text class="mono" x="${cx + 21}" y="${stripY + 50}" font-size="10" letter-spacing="1.5" fill="${GRAY_LIGHT}">${st.label}</text>`;
  });

  s += `</svg>`;
  return s;
}

// ─── Languages panel (composable) ───────────────────────────────────────────
function langPanel(w, h, langs) {
  const filtered = langs.filter((l) => parseFloat(l.percent) >= 1.0).slice(0, 6);
  const rowH = 34;
  const headerBottom = PAD + 40;
  // vertically centre the rows in the space below the header
  const top = headerBottom + Math.max(0, (h - headerBottom - filtered.length * rowH - 8) / 2);
  let s = cardRect(0, 0, w, h) + cardHeader(w, '02', 'LANGUAGES');

  const barX = 138;
  const barMax = w - PAD - barX - 44;
  const maxPct = Math.max(...filtered.map((l) => parseFloat(l.percent)), 1);

  filtered.forEach((lang, i) => {
    const y = top + i * rowH;
    const cy = y + rowH / 2;
    const idx = String(i + 1).padStart(2, '0');
    const shade = BAR_RAMP[Math.min(i, BAR_RAMP.length - 1)];
    const pct = parseFloat(lang.percent);
    const bw = Math.max((pct / maxPct) * barMax, 3);
    s += `<text class="mono" x="${PAD}" y="${cy + 4}" font-size="12" fill="${GRAY_LIGHT}">${idx}</text>`;
    s += `<text x="${PAD + 26}" y="${cy + 4}" font-size="12.5" fill="${INK}">${escapeXml(lang.name)}</text>`;
    s += `<rect x="${barX}" y="${cy - 5}" width="${barMax}" height="10" rx="1" fill="#efefef"/>`;
    s += `<rect class="bar" x="${barX}" y="${cy - 5}" width="${bw.toFixed(1)}" height="10" rx="1" fill="${shade}" style="animation-delay:${(i * 0.09).toFixed(2)}s"/>`;
    s += `<text class="mono" x="${w - PAD}" y="${cy + 4}" font-size="12" fill="${GRAY_MID}" text-anchor="end">${lang.percent}%</text>`;
  });
  return s;
}

// ─── Contribution activity panel (composable, monochrome heatmap) ────────────
function activityPanel(w, h, weeks, totalContributions) {
  const cell = 8;
  const gap = 2;
  const stride = cell + gap;
  const gutterL = 22; // day labels
  const labelTop = 14; // month labels
  const graphX = PAD + gutterL;
  const graphMaxW = w - PAD - graphX;
  const weeksFit = Math.floor(graphMaxW / stride);
  const shown = weeks.slice(Math.max(0, weeks.length - weeksFit));

  const graphH = 7 * stride;
  const blockH = labelTop + graphH + 20 + 8; // month labels + grid + legend
  const headerBottom = PAD + 40;
  const blockTop = headerBottom + Math.max(0, (h - headerBottom - blockH) / 2);
  const graphY = blockTop + labelTop;
  const legendY = graphY + graphH + 20;
  let s = cardRect(0, 0, w, h) + cardHeader(w, '03', 'ACTIVITY');

  // total caption (right-aligned in header row)
  s += `<text class="mono" x="${w - PAD}" y="${PAD + 4}" font-size="11" letter-spacing="1" fill="${GRAY_LIGHT}" text-anchor="end">${totalContributions} / YEAR</text>`;

  // month labels
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  let lastMonth = -1;
  let labels = '';
  shown.forEach((week, wi) => {
    const first = week.contributionDays.find((d) => d && d.date);
    if (!first) return;
    const m = new Date(first.date + 'T00:00:00').getMonth();
    if (m !== lastMonth && wi % 4 === 0) {
      labels += `<text class="mono" x="${graphX + wi * stride}" y="${graphY - 4}" font-size="9" letter-spacing="0.5" fill="${GRAY_LIGHT}">${MONTHS[m]}</text>`;
      lastMonth = m;
    }
  });

  // day labels (Mon / Wed / Fri)
  const DAYS = ['', 'MON', '', 'WED', '', 'FRI', ''];
  DAYS.forEach((label, d) => {
    if (label) labels += `<text class="mono" x="${graphX - 6}" y="${graphY + d * stride + cell}" font-size="8" fill="${GRAY_LIGHT}" text-anchor="end">${label}</text>`;
  });

  // cells
  let cells = '';
  shown.forEach((week, wi) => {
    for (let d = 0; d < 7; d++) {
      const day = week.contributionDays[d];
      if (!day) continue;
      const lvl = day.level !== undefined ? day.level : levelForCount(day.contributionCount);
      const x = graphX + wi * stride;
      const y = graphY + d * stride;
      const delay = (wi * 0.014).toFixed(3);
      cells += `<rect class="cell" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="1.5" fill="${HEAT_RAMP[lvl]}" style="animation-delay:${delay}s"/>`;
    }
  });

  // legend
  const sq = 8;
  const sgap = 3;
  const legTotal = HEAT_RAMP.length * sq + (HEAT_RAMP.length - 1) * sgap;
  const cx = (w - legTotal) / 2;
  let legend = `<text class="mono" x="${cx - 8}" y="${legendY + sq - 1}" font-size="9" fill="${GRAY_LIGHT}" text-anchor="end">LESS</text>`;
  HEAT_RAMP.forEach((c, i) => {
    legend += `<rect x="${cx + i * (sq + sgap)}" y="${legendY}" width="${sq}" height="${sq}" rx="1.5" fill="${c}"/>`;
  });
  legend += `<text class="mono" x="${cx + legTotal + 8}" y="${legendY + sq - 1}" font-size="9" fill="${GRAY_LIGHT}">MORE</text>`;

  return s + labels + cells + legend;
}

// Standalone single cards (kept for reuse / direct embedding).
function renderLanguages(langs) {
  const w = 440;
  return svgHead(w, H_HALF) + langPanel(w, H_HALF, langs) + `</svg>`;
}
function renderContributions(weeks, totalContributions) {
  const w = 440;
  return svgHead(w, H_HALF) + activityPanel(w, H_HALF, weeks, totalContributions) + `</svg>`;
}

// Combined "row": languages + activity side by side in one scalable image.
function renderRow(langs, weeks, totalContributions) {
  const panelW = 430;
  const gap = 40;
  const w = panelW * 2 + gap;
  let s = svgHead(w, H_HALF);
  s += `<g transform="translate(0,0)">${langPanel(panelW, H_HALF, langs)}</g>`;
  s += `<g transform="translate(${panelW + gap},0)">${activityPanel(panelW, H_HALF, weeks, totalContributions)}</g>`;
  return s + `</svg>`;
}

// ─── Streak / overview card (pixel numbers + sparkline) ──────────────────────
function renderStreak(streak, weeks) {
  const w = 900;
  const h = 208;
  let s = svgOpen(w, h);
  s += cardHeader(w, '04', 'STREAK');

  const top = PAD + 40;
  const numbers = [
    { value: streak.total, label: 'TOTAL CONTRIBUTIONS' },
    { value: streak.current, label: 'CURRENT STREAK' },
    { value: streak.longest, label: 'LONGEST STREAK' },
  ];

  // Left: three pixel-number columns.
  const cellSz = 6;
  const colW = 190;
  const colStart = PAD;
  numbers.forEach((n, i) => {
    const colCx = colStart + colW * i + colW / 2;
    const txt = String(n.value);
    const nw = pixelWidth(txt, cellSz);
    const nx = colCx - nw / 2;
    const ny = top + 18;
    const pix = pixelDigits(txt, nx, ny, cellSz, INK, '');
    s += `<g class="pix" style="animation-delay:${(i * 0.12 + 0.1).toFixed(2)}s">${pix.svg}</g>`;
    s += `<text class="mono" x="${colCx}" y="${ny + 42 + 22}" font-size="10.5" letter-spacing="1.3" fill="${GRAY_LIGHT}" text-anchor="middle">${n.label}</text>`;
    if (i < numbers.length - 1) {
      const lx = colStart + colW * (i + 1);
      s += `<line x1="${lx}" y1="${top + 6}" x2="${lx}" y2="${top + 78}" stroke="${BORDER}" stroke-width="1"/>`;
    }
  });

  // Right: weekly-contribution sparkline.
  const sparkX = colStart + colW * 3 + 30;
  const sparkY = top + 6;
  const sparkW = w - PAD - sparkX;
  const sparkH = 80;
  s += `<line x1="${sparkX - 15}" y1="${top + 6}" x2="${sparkX - 15}" y2="${top + 78}" stroke="${BORDER}" stroke-width="1"/>`;
  s += `<text class="mono" x="${sparkX}" y="${sparkY + 4}" font-size="10.5" letter-spacing="1.3" fill="${GRAY_LIGHT}">WEEKLY ACTIVITY · LAST ${Math.min(weeks.length, 30)} WEEKS</text>`;
  s += sparkline(weeks, sparkX, sparkY + 16, sparkW, sparkH);

  s += `</svg>`;
  return s;
}

function sparkline(weeks, x, y, w, h) {
  const recent = weeks.slice(Math.max(0, weeks.length - 30));
  const vals = recent.map((wk) => wk.contributionDays.reduce((a, d) => a + ((d && d.contributionCount) || 0), 0));
  const maxV = Math.max(...vals, 1);
  const n = vals.length;
  const step = n > 1 ? w / (n - 1) : w;
  const pts = vals.map((v, i) => [x + i * step, y + h - (v / maxV) * h]);
  const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${x},${y + h} ${line} ${x + (n - 1) * step},${y + h}`;
  const baseline = `<line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" stroke="${BORDER}" stroke-width="1"/>`;
  const fill = `<polygon class="sparkfill" points="${area}" fill="${INK}" opacity="0.05"/>`;
  const stroke = `<polyline class="spark" points="${line}" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  // marker on last point
  const last = pts[pts.length - 1];
  const dot = `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3" fill="${INK}"/>`;
  return baseline + fill + stroke + dot;
}

// ─── helpers ────────────────────────────────────────────────────────────────
function escapeXml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function levelForCount(count) {
  if (!count) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 8) return 3;
  return 4;
}

function computeStreak(weeks) {
  const allDays = weeks.flatMap((w) => w.contributionDays).filter(Boolean);
  const today = new Date().toISOString().split('T')[0];
  let current = 0;
  for (let i = allDays.length - 1; i >= 0; i--) {
    const day = allDays[i];
    if (day.contributionCount > 0) current++;
    else if (i === allDays.length - 1 && day.date === today) continue;
    else break;
  }
  let longest = 0;
  let temp = 0;
  for (const day of allDays) {
    if (day.contributionCount > 0) { temp++; longest = Math.max(longest, temp); } else temp = 0;
  }
  return { current, longest };
}

// ─── data fetch (CI path) ───────────────────────────────────────────────────
async function queryGraphQL(query) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `bearer ${TOKEN}` },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`GraphQL error: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

async function fetchRest(endpoint) {
  const headers = { Accept: 'application/vnd.github.v3+json', 'User-Agent': `${USERNAME}-profile` };
  if (TOKEN) headers.Authorization = `token ${TOKEN}`;
  const res = await fetch(`https://api.github.com/${endpoint}`, { headers });
  if (!res.ok) throw new Error(`REST error: ${res.status} on ${endpoint}`);
  return res.json();
}

async function fetchData() {
  const gql = await queryGraphQL(`
    query {
      user(login: "${USERNAME}") {
        followers { totalCount }
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
          totalCount
          nodes {
            stargazerCount
            forkCount
            languages(first: 10) { edges { size node { name } } }
          }
        }
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks { contributionDays { contributionCount date } }
          }
        }
      }
    }`);

  const user = gql.user;
  const repos = user.repositories.nodes;

  const summary = {
    followers: user.followers.totalCount,
    repos: user.repositories.totalCount,
    stars: repos.reduce((a, r) => a + r.stargazerCount, 0),
    forks: repos.reduce((a, r) => a + r.forkCount, 0),
  };

  const langTotals = {};
  let totalBytes = 0;
  repos.forEach((repo) => {
    (repo.languages?.edges || []).forEach((edge) => {
      langTotals[edge.node.name] = (langTotals[edge.node.name] || 0) + edge.size;
      totalBytes += edge.size;
    });
  });
  const langs = Object.entries(langTotals)
    .map(([name, bytes]) => ({ name, percent: ((bytes / totalBytes) * 100).toFixed(1) }))
    .sort((a, b) => parseFloat(b.percent) - parseFloat(a.percent))
    .slice(0, 8);

  const cal = user.contributionsCollection.contributionCalendar;
  const weeks = cal.weeks;
  const streak = { total: cal.totalContributions, ...computeStreak(weeks) };

  return { summary, langs, weeks, totalContributions: cal.totalContributions, streak };
}

// ─── writer ─────────────────────────────────────────────────────────────────
function writeCards(data) {
  fs.mkdirSync('stats', { recursive: true });
  fs.writeFileSync('stats/header.svg', renderHeader(data.summary));
  fs.writeFileSync('stats/row.svg', renderRow(data.langs, data.weeks, data.totalContributions));
  fs.writeFileSync('stats/streak.svg', renderStreak(data.streak, data.weeks));
}

async function main() {
  try {
    const data = await fetchData();
    writeCards(data);
    console.log('Done — Ghost stat cards generated.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

module.exports = {
  renderHeader,
  renderLanguages,
  renderContributions,
  renderRow,
  renderStreak,
  computeStreak,
  writeCards,
  levelForCount,
};

if (require.main === module) main();
