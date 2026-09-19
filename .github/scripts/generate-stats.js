/**
 * Kōzu Group — profile stat cards.
 *
 * Rendered to self-contained SVG in the Kōzu Group design language: neutral
 * paper, near-black ink, a four-step text ramp, hairlines before shadows, no
 * radii, no decorative colour. Quattrocento (display) carries the figures;
 * Inter carries everything else. The cards are deliberately
 * static — the brand reserves motion for the typewriter on kozugroup.com.
 *
 * Because GitHub serves these as <img>, webfonts never load; the families below
 * are the design system's own declared fallback chains.
 *
 * Render functions are pure (data in, SVG string out) and exported so the same
 * code path renders live (in CI, with a token) or from a snapshot.
 */
const fs = require('fs');

const USERNAME = process.env.GITHUB_USERNAME || 'thekozugroup';
const TOKEN = process.env.GITHUB_TOKEN;

// ─── Kōzu tokens (tokens/color.css) ─────────────────────────────────────────
const PAPER = '#f5f6f7'; // --kz-paper
const PAPER_INSET = '#e3e5e7'; // --kz-paper-inset — bar tracks
const INK = '#212325'; // --kz-text-primary
const INK2 = '#36383a'; // --kz-ink-2
const INK3 = '#535558'; // --kz-text-secondary
const INK4 = '#6a6c6f'; // --kz-text-muted — lightest tone allowed to carry text
const LINE = '#2123251a'; // --kz-line — the default hairline

// Graphic ramps. ink-5 is permitted here: these are graphics, never text.
const BAR_RAMP = ['#212325', '#36383a', '#4a4c4f', '#535558', '#6a6c6f', '#8a8c8f'];
const HEAT_RAMP = ['#e3e5e7', '#afb1b4', '#6a6c6f', '#36383a', '#212325'];

// tokens/typography.css — declared fallback chains (webfonts cannot load here)
const DISPLAY = '"Quattrocento",Georgia,"Times New Roman",serif';
const TEXT = '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif';

const PAD = 32; // on the 2·4·6·8·12·16·20·24·32… scale
const H_ROW = 280; // shared height of the two side-by-side panels

// ─── The refined Kōzu mark ──────────────────────────────────────────────────
const MARK_PATH =
  'M0 1490L192 1490L192 1060.23A60 60 0 0 1 282 1008.27L1116.38 1490L1207.88 1331.52L282 796.96A60 60 0 0 1 282 693.04L1207.88 158.48L1116.38 0L282 481.73A60 60 0 0 1 192 429.77L192 0L0 0Z';
const MARK_W = 1207.88;
const MARK_H = 1490;

/** The mark at a given cap height, its top-left at (x, y). */
function logoMark(x, y, height, fill) {
  const s = height / MARK_H;
  return `<g transform="translate(${x.toFixed(2)},${y.toFixed(2)}) scale(${s.toFixed(5)})"><path d="${MARK_PATH}" fill="${fill || INK}"/></g>`;
}

// ─── primitives ─────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Rough advance width; enough to place a hairline after a label. */
function textWidth(str, size, tracking) {
  return String(str).length * (size * 0.62 + (tracking || 0));
}

function svgHead(w, h) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img">
<style>text{font-family:${TEXT};}.display{font-family:${DISPLAY};}</style>`;
}

/** A resting card: flat paper, one hairline, square corners. */
function cardRect(x, y, w, h) {
  return `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" fill="${PAPER}" stroke="${LINE}" stroke-width="1"/>`;
}

/** Uppercase metadata — 12px / 0.08em, per the type rules. */
function meta(x, y, str, fill, anchor) {
  const a = anchor ? ` text-anchor="${anchor}"` : '';
  return `<text x="${x}" y="${y}" font-size="12" font-weight="500" letter-spacing="0.96" fill="${fill || INK3}"${a}>${esc(str)}</text>`;
}

/**
 * The design system's Rule-with-label: a label, then a hairline running to the
 * right edge. An optional right-hand figure sits at the end of the rule.
 */
function ruleLabel(x, y, w, label, right) {
  const lw = textWidth(label, 12, 0.96);
  let s = meta(x, y + 4, label, INK3);
  let lineStart = x + lw + 16;
  let lineEnd = x + w;
  if (right) {
    const rw = textWidth(right, 12, 0.96);
    lineEnd = x + w - rw - 16;
    s += meta(x + w, y + 4, right, INK4, 'end');
  }
  s += `<line x1="${lineStart.toFixed(1)}" y1="${y}" x2="${lineEnd.toFixed(1)}" y2="${y}" stroke="${LINE}" stroke-width="1"/>`;
  return s;
}

// ─── header / hero ──────────────────────────────────────────────────────────
function renderHeader(summary) {
  const w = 900;
  const h = 184;
  let s = svgHead(w, h) + cardRect(0, 0, w, h);

  // The mark alone, at the site header size (28px). No wordmark.
  const markH = 28;
  const markY = 32;
  s += logoMark(PAD, markY, markH, INK);

  // Right-hand metadata, mirroring the site footer.
  s += meta(w - PAD, markY + 18, 'EST. 2026', INK4, 'end');

  // Hairline, then the stat strip.
  const stripY = 88;
  s += `<line x1="${PAD}" y1="${stripY}" x2="${w - PAD}" y2="${stripY}" stroke="${LINE}" stroke-width="1"/>`;

  const stats = [
    { label: 'FOLLOWERS', value: summary.followers },
    { label: 'STARS', value: summary.stars },
    { label: 'FORKS', value: summary.forks },
    { label: 'REPOSITORIES', value: summary.repos },
  ];
  const colW = (w - PAD * 2) / stats.length;
  stats.forEach((st, i) => {
    const cx = PAD + colW * i;
    if (i > 0) s += `<line x1="${cx.toFixed(1)}" y1="${stripY + 16}" x2="${cx.toFixed(1)}" y2="${stripY + 60}" stroke="${LINE}" stroke-width="1"/>`;
    const tx = i === 0 ? cx : cx + 24;
    s += `<text class="display" x="${tx.toFixed(1)}" y="${stripY + 48}" font-size="32" fill="${INK}">${st.value}</text>`;
    s += meta(tx + 1, stripY + 68, st.label, INK4);
  });

  return s + '</svg>';
}

// ─── languages panel ────────────────────────────────────────────────────────
function langPanel(w, h, langs) {
  const shown = langs.filter((l) => parseFloat(l.percent) >= 1.0).slice(0, 6);
  let s = cardRect(0, 0, w, h) + ruleLabel(PAD, PAD + 8, w - PAD * 2, 'LANGUAGES');

  const rowH = 32;
  const top = PAD + 44;
  const barX = 132;
  const barMax = w - PAD - barX - 46;
  const max = Math.max(...shown.map((l) => parseFloat(l.percent)), 1);

  shown.forEach((lang, i) => {
    const cy = top + i * rowH + rowH / 2;
    const bw = Math.max((parseFloat(lang.percent) / max) * barMax, 2);
    s += `<text x="${PAD}" y="${cy + 4}" font-size="12" letter-spacing="0.96" fill="${INK4}">${String(i + 1).padStart(2, '0')}</text>`;
    s += `<text x="${PAD + 26}" y="${cy + 4}" font-size="13" letter-spacing="0.13" fill="${INK}">${esc(lang.name)}</text>`;
    s += `<rect x="${barX}" y="${cy - 4}" width="${barMax}" height="8" fill="${PAPER_INSET}"/>`;
    s += `<rect x="${barX}" y="${cy - 4}" width="${bw.toFixed(1)}" height="8" fill="${BAR_RAMP[Math.min(i, BAR_RAMP.length - 1)]}"/>`;
    s += `<text x="${w - PAD}" y="${cy + 4}" font-size="12" fill="${INK3}" text-anchor="end">${lang.percent}%</text>`;
  });
  return s;
}

// ─── activity panel ─────────────────────────────────────────────────────────
function activityPanel(w, h, weeks, total) {
  let s = cardRect(0, 0, w, h) + ruleLabel(PAD, PAD + 8, w - PAD * 2, 'ACTIVITY', `${total} / YEAR`);

  const cell = 8;
  const gap = 2;
  const stride = cell + gap;
  const gutter = 26; // day labels
  const gx = PAD + gutter;
  const fit = Math.floor((w - PAD - gx) / stride);
  const shown = weeks.slice(Math.max(0, weeks.length - fit));

  const gridH = 7 * stride;
  const blockH = 14 + gridH + 26;
  const top = PAD + 44 + Math.max(0, (h - (PAD + 44) - blockH - PAD) / 2);
  const gy = top + 14;

  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  let last = -1;
  shown.forEach((wk, i) => {
    const d = wk.contributionDays.find((x) => x && x.date);
    if (!d) return;
    const m = new Date(d.date + 'T00:00:00').getMonth();
    if (m !== last && i % 4 === 0) {
      s += `<text x="${(gx + i * stride).toFixed(1)}" y="${gy - 5}" font-size="11" letter-spacing="0.5" fill="${INK4}">${MONTHS[m]}</text>`;
      last = m;
    }
  });

  ['', 'MON', '', 'WED', '', 'FRI', ''].forEach((lab, d) => {
    if (lab) s += `<text x="${gx - 8}" y="${gy + d * stride + cell}" font-size="11" fill="${INK4}" text-anchor="end">${lab}</text>`;
  });

  shown.forEach((wk, i) => {
    for (let d = 0; d < 7; d++) {
      const day = wk.contributionDays[d];
      if (!day) continue;
      const lvl = day.level !== undefined ? day.level : levelForCount(day.contributionCount);
      s += `<rect x="${(gx + i * stride).toFixed(1)}" y="${gy + d * stride}" width="${cell}" height="${cell}" fill="${HEAT_RAMP[lvl]}"/>`;
    }
  });

  // Legend
  const sq = 8;
  const sgap = 3;
  const totalW = HEAT_RAMP.length * sq + (HEAT_RAMP.length - 1) * sgap;
  const lx = w - PAD - totalW - 40;
  const ly = gy + gridH + 18;
  s += `<text x="${lx - 8}" y="${ly + sq - 1}" font-size="11" fill="${INK4}" text-anchor="end">LESS</text>`;
  HEAT_RAMP.forEach((c, i) => {
    s += `<rect x="${(lx + i * (sq + sgap)).toFixed(1)}" y="${ly}" width="${sq}" height="${sq}" fill="${c}"/>`;
  });
  s += `<text x="${(lx + totalW + 8).toFixed(1)}" y="${ly + sq - 1}" font-size="11" fill="${INK4}">MORE</text>`;
  return s;
}

/** The two data panels, side by side in one scalable image. */
function renderRow(langs, weeks, total) {
  const panelW = 430;
  const gap = 40;
  const w = panelW * 2 + gap;
  let s = svgHead(w, H_ROW);
  s += `<g>${langPanel(panelW, H_ROW, langs)}</g>`;
  s += `<g transform="translate(${panelW + gap},0)">${activityPanel(panelW, H_ROW, weeks, total)}</g>`;
  return s + '</svg>';
}

// ─── contributions / streak ─────────────────────────────────────────────────
function renderStreak(streak, weeks) {
  const w = 900;
  const h = 200;
  let s = svgHead(w, h) + cardRect(0, 0, w, h);
  s += ruleLabel(PAD, PAD + 8, w - PAD * 2, 'CONTRIBUTIONS');

  const figures = [
    { value: streak.total, label: 'TOTAL' },
    { value: streak.current, label: 'CURRENT STREAK' },
    { value: streak.longest, label: 'LONGEST STREAK' },
  ];
  const top = PAD + 56;
  const colW = 176;
  figures.forEach((f, i) => {
    const x = PAD + colW * i;
    if (i > 0) s += `<line x1="${(x - 24).toFixed(1)}" y1="${top - 8}" x2="${(x - 24).toFixed(1)}" y2="${top + 62}" stroke="${LINE}" stroke-width="1"/>`;
    s += `<text class="display" x="${x}" y="${top + 34}" font-size="42" fill="${INK}">${f.value}</text>`;
    s += meta(x + 1, top + 56, f.label, INK4);
  });

  const sx = PAD + colW * 3 + 8;
  const sw = w - PAD - sx;
  s += `<line x1="${(sx - 24).toFixed(1)}" y1="${top - 8}" x2="${(sx - 24).toFixed(1)}" y2="${top + 62}" stroke="${LINE}" stroke-width="1"/>`;
  s += meta(sx, top - 12, 'WEEKLY', INK4);
  s += sparkline(weeks, sx, top, sw, 62);
  return s + '</svg>';
}

function sparkline(weeks, x, y, w, h) {
  const recent = weeks.slice(Math.max(0, weeks.length - 30));
  const vals = recent.map((wk) => wk.contributionDays.reduce((a, d) => a + ((d && d.contributionCount) || 0), 0));
  const max = Math.max(...vals, 1);
  const n = vals.length;
  const step = n > 1 ? w / (n - 1) : w;
  const pts = vals.map((v, i) => [x + i * step, y + h - (v / max) * h]);
  const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  let s = `<line x1="${x}" y1="${y + h}" x2="${(x + w).toFixed(1)}" y2="${y + h}" stroke="${LINE}" stroke-width="1"/>`;
  s += `<polygon points="${x},${y + h} ${line} ${(x + (n - 1) * step).toFixed(1)},${y + h}" fill="${INK}" fill-opacity="0.06"/>`;
  s += `<polyline points="${line}" fill="none" stroke="${INK2}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  const last = pts[pts.length - 1];
  s += `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.5" fill="${INK}"/>`;
  return s;
}

// ─── helpers ────────────────────────────────────────────────────────────────
function levelForCount(c) {
  if (!c) return 0;
  if (c <= 2) return 1;
  if (c <= 5) return 2;
  if (c <= 8) return 3;
  return 4;
}

function computeStreak(weeks) {
  const days = weeks.flatMap((w) => w.contributionDays).filter(Boolean);
  const today = new Date().toISOString().split('T')[0];
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (d.contributionCount > 0) current++;
    else if (i === days.length - 1 && d.date === today) continue;
    else break;
  }
  let longest = 0;
  let run = 0;
  for (const d of days) {
    if (d.contributionCount > 0) { run++; longest = Math.max(longest, run); } else run = 0;
  }
  return { current, longest };
}

// ─── data ───────────────────────────────────────────────────────────────────
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

  const totals = {};
  let bytes = 0;
  repos.forEach((r) => {
    (r.languages?.edges || []).forEach((e) => {
      totals[e.node.name] = (totals[e.node.name] || 0) + e.size;
      bytes += e.size;
    });
  });
  const langs = Object.entries(totals)
    .map(([name, b]) => ({ name, percent: ((b / bytes) * 100).toFixed(1) }))
    .sort((a, b) => parseFloat(b.percent) - parseFloat(a.percent))
    .slice(0, 8);

  const cal = user.contributionsCollection.contributionCalendar;
  return {
    summary,
    langs,
    weeks: cal.weeks,
    totalContributions: cal.totalContributions,
    streak: { total: cal.totalContributions, ...computeStreak(cal.weeks) },
  };
}

function writeCards(data) {
  fs.mkdirSync('stats', { recursive: true });
  fs.writeFileSync('stats/header.svg', renderHeader(data.summary));
  fs.writeFileSync('stats/row.svg', renderRow(data.langs, data.weeks, data.totalContributions));
  fs.writeFileSync('stats/streak.svg', renderStreak(data.streak, data.weeks));
}

async function main() {
  try {
    writeCards(await fetchData());
    console.log('Done — Kōzu stat cards generated.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

module.exports = { renderHeader, renderRow, renderStreak, langPanel, activityPanel, computeStreak, writeCards, levelForCount };

if (require.main === module) main();
