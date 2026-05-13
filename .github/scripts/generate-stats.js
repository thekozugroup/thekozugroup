const fs = require('fs');

const USERNAME = process.env.GITHUB_USERNAME || 'thekozugroup';
const TOKEN = process.env.GITHUB_TOKEN;

const CARD_WIDTH = 480;
const CARD_RADIUS = 12;
const CARD_PADDING = 24;
const CARD_BG = '#ffffff';
const CARD_BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const TEXT_MUTED = '#9ca3af';
const ACCENT = '#2563eb';
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

async function queryGitHubGraphQL(query) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`GraphQL error: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

async function fetchGitHubRest(endpoint) {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (TOKEN) headers.Authorization = `token ${TOKEN}`;
  const res = await fetch(`https://api.github.com/${endpoint}`, { headers });
  if (!res.ok) throw new Error(`REST error: ${res.status} on ${endpoint}`);
  return res.json();
}

// ─── Card Shell ───
function cardShell(title, iconSvg, content, height) {
  const w = CARD_WIDTH;
  const r = CARD_RADIUS;
  const shadowId = `shadow-${Math.random().toString(36).slice(2)}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="${shadowId}" x="-2%" y="-2%" width="108%" height="112%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000000" flood-opacity="0.06"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="${w}" height="${height}" rx="${r}" fill="${CARD_BG}" stroke="${CARD_BORDER}" stroke-width="1" filter="url(#${shadowId})"/>
  <g transform="translate(${CARD_PADDING}, 20)">
    <g transform="scale(0.9)">${iconSvg}</g>
    <text x="28" y="14" font-family="${FONT}" font-size="12" font-weight="600" fill="${TEXT_MUTED}" letter-spacing="0.08em" text-transform="uppercase">${title.toUpperCase()}</text>
  </g>
  <line x1="${CARD_PADDING}" y1="48" x2="${w - CARD_PADDING}" y2="48" stroke="${CARD_BORDER}" stroke-width="1"/>
  <g transform="translate(${CARD_PADDING}, 56)">
    ${content}
  </g>
</svg>`;
}

// ─── Streak Card ───
function generateStreakCard(data) {
  const total = data.user.contributionsCollection.contributionCalendar.totalContributions;
  const weeks = data.user.contributionsCollection.contributionCalendar.weeks;
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  
  // Flatten all days
  const allDays = weeks.flatMap(w => w.contributionDays);
  
  // Calculate streaks from the end (most recent)
  for (let i = allDays.length - 1; i >= 0; i--) {
    if (allDays[i].contributionCount > 0) {
      tempStreak++;
    } else {
      if (i === allDays.length - 1) {
        // Today might not be over yet, check if it's actually today
        const today = new Date().toISOString().split('T')[0];
        if (allDays[i].date === today) continue;
      }
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 0;
      if (currentStreak === 0) currentStreak = longestStreak;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);
  if (currentStreak === 0) currentStreak = tempStreak;

  const icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c0 0-6 8-6 13a6 6 0 0012 0c0-5-6-13-6-13z"/><path d="M12 22c0 0 4-4 4-8" stroke="#fbbf24"/></svg>`;

  const col1X = 0;
  const col2X = (CARD_WIDTH - CARD_PADDING * 2) / 3;
  const col3X = ((CARD_WIDTH - CARD_PADDING * 2) / 3) * 2;
  const colWidth = (CARD_WIDTH - CARD_PADDING * 2) / 3;

  const content = `
    <text x="${col1X + colWidth/2}" y="30" text-anchor="middle" font-family="${FONT}" font-size="28" font-weight="700" fill="${TEXT_PRIMARY}">${total}</text>
    <text x="${col1X + colWidth/2}" y="50" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="500" fill="${TEXT_SECONDARY}">Total</text>
    <text x="${col1X + colWidth/2}" y="65" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="500" fill="${TEXT_SECONDARY}">Contributions</text>

    <text x="${col2X + colWidth/2}" y="30" text-anchor="middle" font-family="${FONT}" font-size="28" font-weight="700" fill="${ACCENT}">${currentStreak}</text>
    <text x="${col2X + colWidth/2}" y="50" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="500" fill="${TEXT_SECONDARY}">Current</text>
    <text x="${col2X + colWidth/2}" y="65" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="500" fill="${TEXT_SECONDARY}">Streak</text>

    <text x="${col3X + colWidth/2}" y="30" text-anchor="middle" font-family="${FONT}" font-size="28" font-weight="700" fill="${TEXT_PRIMARY}">${longestStreak}</text>
    <text x="${col3X + colWidth/2}" y="50" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="500" fill="${TEXT_SECONDARY}">Longest</text>
    <text x="${col3X + colWidth/2}" y="65" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="500" fill="${TEXT_SECONDARY}">Streak</text>
  `;

  const svg = cardShell('Contribution Streak', icon, content, 148);
  fs.writeFileSync('stats/streak.svg', svg);
}

// ─── Contribution Graph Card ───
function generateContributionGraph(data) {
  const weeks = data.user.contributionsCollection.contributionCalendar.weeks;
  const levels = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
  
  const cellSize = 6;
  const cellGap = 2;
  const weekStride = cellSize + cellGap;
  const weeksToShow = Math.min(weeks.length, 48); // ~11 months fits cleanly
  const graphWidth = weeksToShow * weekStride;
  const graphHeight = 7 * weekStride;
  
  const contentWidth = CARD_WIDTH - CARD_PADDING * 2;
  const offsetX = (contentWidth - graphWidth) / 2;
  const offsetY = 14;

  let cells = '';
  const monthLabels = [];
  let lastMonth = -1;

  for (let w = 0; w < weeksToShow; w++) {
    const week = weeks[weeks.length - weeksToShow + w];
    for (let d = 0; d < 7; d++) {
      const day = week.contributionDays[d];
      if (!day) continue;
      const count = day.contributionCount;
      let color;
      if (count === 0) color = levels[0];
      else if (count <= 2) color = levels[1];
      else if (count <= 5) color = levels[2];
      else if (count <= 8) color = levels[3];
      else color = levels[4];

      const x = offsetX + w * weekStride;
      const y = offsetY + d * weekStride;
      cells += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="1.5" fill="${color}"/>\n`;
    }

    const firstDay = week.contributionDays[0];
    if (firstDay) {
      const month = new Date(firstDay.date).getMonth();
      if (month !== lastMonth && w % 4 === 0) {
        monthLabels.push({
          x: offsetX + w * weekStride,
          label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month]
        });
        lastMonth = month;
      }
    }
  }

  let labels = '';
  monthLabels.forEach(m => {
    labels += `<text x="${m.x}" y="${offsetY - 4}" font-family="${FONT}" font-size="9" fill="${TEXT_MUTED}">${m.label}</text>\n`;
  });

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  dayLabels.forEach((label, i) => {
    if (label) {
      labels += `<text x="${offsetX - 6}" y="${offsetY + i * weekStride + 5}" text-anchor="end" font-family="${FONT}" font-size="9" fill="${TEXT_MUTED}">${label}</text>\n`;
    }
  });

  // Legend — positioned at right edge of card content area
  const legendY = offsetY + graphHeight + 14;
  const legendRightX = contentWidth;
  const legendItemWidth = 10;
  const legendGap = 3;
  const legendTotalWidth = 30 + (levels.length * legendItemWidth) + ((levels.length - 1) * legendGap) + 4;
  const legendX = legendRightX - legendTotalWidth;
  
  let legend = `<text x="${legendX}" y="${legendY}" font-family="${FONT}" font-size="9" fill="${TEXT_MUTED}">Less</text>\n`;
  levels.forEach((color, i) => {
    legend += `<rect x="${legendX + 30 + i * (legendItemWidth + legendGap)}" y="${legendY - 8}" width="${legendItemWidth}" height="${legendItemWidth}" rx="2" fill="${color}"/>\n`;
  });
  legend += `<text x="${legendX + 30 + levels.length * (legendItemWidth + legendGap)}" y="${legendY}" font-family="${FONT}" font-size="9" fill="${TEXT_MUTED}">More</text>\n`;

  const icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;

  const content = labels + cells + legend;
  const contentHeight = offsetY + graphHeight + 28;
  const svg = cardShell('Contribution Activity', icon, content, 56 + contentHeight);
  fs.writeFileSync('stats/contributions.svg', svg);
}

// ─── Languages Card ───
function generateLanguageCard(repos) {
  const langMap = {};
  let totalBytes = 0;

  repos.forEach(repo => {
    if (repo.fork) return;
    (repo.languages?.nodes || []).forEach(lang => {
      // We need byte counts. GraphQL doesn't give bytes directly in this query easily without extra complexity.
      // Fallback: use REST API language data combined with GraphQL repo list
    });
  });

  // Since we need byte counts and GraphQL color info, let's do a hybrid approach:
  // Use REST API for byte counts (as we did before) but match colors from GraphQL if available
}

const LANG_COLORS = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5',
  Rust: '#dea584', Go: '#00ADD8', HTML: '#e34c26', CSS: '#563d7c',
  Java: '#b07219', 'C++': '#f34b7d', Vue: '#41b883', PHP: '#4F5D95',
  Ruby: '#701516', Swift: '#F05138', Shell: '#89e051', 'C#': '#178600',
  Kotlin: '#A97BFF', Dart: '#00B4AB', Scala: '#c22d40', R: '#198CE7',
  'Objective-C': '#438eff', Elixir: '#6e4a7e', Clojure: '#db5855',
  Haskell: '#5e5086', Lua: '#000080', Perl: '#0298c3', Erlang: '#B83998',
  Julia: '#a270ba', OCaml: '#3be133', F: '#b845fc', PowerShell: '#012456',
  'Jupyter Notebook': '#DA5B0B', Dockerfile: '#384d54', Makefile: '#427819',
  C: '#555555'
};

async function fetchRestLanguages(repos) {
  const ownRepos = repos.filter(r => !r.fork);
  const langData = await Promise.all(
    ownRepos.map(async (repo) => {
      try {
        const res = await fetch(repo.languages_url, {
          headers: TOKEN ? { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json' } : { Accept: 'application/vnd.github.v3+json' }
        });
        return res.ok ? res.json() : {};
      } catch {
        return {};
      }
    })
  );

  const totals = {};
  let sum = 0;
  langData.forEach((map) => {
    Object.entries(map).forEach(([lang, bytes]) => {
      totals[lang] = (totals[lang] || 0) + bytes;
      sum += bytes;
    });
  });

  return Object.entries(totals)
    .map(([name, bytes]) => ({
      name,
      percent: ((bytes / sum) * 100).toFixed(1),
      color: LANG_COLORS[name] || '#6e7681',
    }))
    .sort((a, b) => parseFloat(b.percent) - parseFloat(a.percent))
    .slice(0, 8);
}

async function generateLanguageCard(sortedLangs) {
  // Filter out microscopic bars (less than 1% looks broken)
  const filteredLangs = sortedLangs.filter(l => parseFloat(l.percent) >= 1.0);
  
  const barHeight = 22;
  const barGap = 10;
  const labelWidth = 110;
  const graphContentHeight = filteredLangs.length * (barHeight + barGap);
  
  let langContent = '';
  filteredLangs.forEach((lang, i) => {
    const y = i * (barHeight + barGap);
    const barMaxWidth = (CARD_WIDTH - CARD_PADDING * 2) - labelWidth - 50;
    const barWidth = Math.max((parseFloat(lang.percent) / 100) * barMaxWidth, 4); // Min 4px so tiny bars still visible
    
    langContent += `  <circle cx="6" cy="${y + barHeight/2}" r="5" fill="${lang.color}"/>
  <text x="20" y="${y + barHeight/2 + 4}" font-family="${FONT}" font-size="13" font-weight="500" fill="${TEXT_PRIMARY}">${lang.name}</text>
  <rect x="${labelWidth}" y="${y + 3}" width="${barMaxWidth}" height="${barHeight - 6}" rx="4" fill="#f3f4f6"/>
  <rect x="${labelWidth}" y="${y + 3}" width="${barWidth}" height="${barHeight - 6}" rx="4" fill="${lang.color}" opacity="0.85"/>
  <text x="${labelWidth + barMaxWidth + 10}" y="${y + barHeight/2 + 4}" font-family="${FONT}" font-size="12" fill="${TEXT_SECONDARY}">${lang.percent}%</text>
`;
  });

  const langIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
  const langCard = cardShell('Most Used Languages', langIcon, langContent, 56 + graphContentHeight);
  fs.writeFileSync('stats/languages.svg', langCard);
}

async function main() {
  try {
    fs.mkdirSync('stats', { recursive: true });

    let graphQLData = null;
    let sortedLangs = null;

    // Try GraphQL first (better colors + contribution data)
    if (TOKEN) {
      try {
        console.log('Fetching GraphQL data...');
        graphQLData = await queryGitHubGraphQL(`
          query {
            user(login: "${USERNAME}") {
              contributionsCollection {
                contributionCalendar {
                  totalContributions
                  weeks {
                    contributionDays {
                      contributionCount
                      date
                    }
                  }
                }
              }
              repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
                nodes {
                  name
                  languages(first: 10) {
                    edges {
                      size
                      node {
                        name
                        color
                      }
                    }
                  }
                }
              }
            }
          }
        `);

        // Process languages from GraphQL
        const langTotals = {};
        let totalBytes = 0;
        const repos = graphQLData.user.repositories.nodes;
        
        repos.forEach(repo => {
          (repo.languages?.edges || []).forEach(edge => {
            const name = edge.node.name;
            const bytes = edge.size;
            const color = edge.node.color;
            if (!langTotals[name]) {
              langTotals[name] = { bytes: 0, color };
            }
            langTotals[name].bytes += bytes;
            totalBytes += bytes;
          });
        });

        sortedLangs = Object.entries(langTotals)
          .map(([name, data]) => ({
            name,
            percent: ((data.bytes / totalBytes) * 100).toFixed(1),
            color: data.color || '#6e7681',
          }))
          .sort((a, b) => parseFloat(b.percent) - parseFloat(a.percent))
          .slice(0, 8);

        console.log('GraphQL data fetched successfully.');
      } catch (err) {
        console.log('GraphQL failed, falling back to REST:', err.message);
        graphQLData = null;
      }
    }

    // Fallback to REST for profile/repos
    console.log('Fetching REST data...');
    const profile = await fetchGitHubRest(`users/${USERNAME}`);
    const repos = await fetchGitHubRest(`users/${USERNAME}/repos?per_page=100&sort=updated`);

    if (!sortedLangs) {
      sortedLangs = await fetchRestLanguages(repos);
    }

    // Generate contribution data from REST if GraphQL failed
    if (!graphQLData) {
      // Create pseudo contribution data from commit activity
      const createdAt = new Date(profile.created_at);
      const now = new Date();
      const weeks = [];
      const totalWeeks = 52;
      
      for (let w = 0; w < totalWeeks; w++) {
        const days = [];
        for (let d = 0; d < 7; d++) {
          const date = new Date(now.getTime() - ((totalWeeks - w) * 7 + (6 - d)) * 24 * 60 * 60 * 1000);
          // Use repo push dates to estimate activity
          const activity = repos.filter(r => {
            const pushed = new Date(r.pushed_at);
            return pushed.toDateString() === date.toDateString();
          }).length;
          days.push({
            contributionCount: activity > 0 ? Math.min(activity * 3 + 1, 10) : 0,
            date: date.toISOString().split('T')[0]
          });
        }
        weeks.push({ contributionDays: days });
      }

      graphQLData = {
        user: {
          contributionsCollection: {
            contributionCalendar: {
              totalContributions: repos.reduce((acc, r) => acc + (r.pushed_at ? 1 : 0), 0) * 3,
              weeks: weeks
            }
          }
        }
      };
    }

    console.log('Generating streak card...');
    generateStreakCard(graphQLData);

    console.log('Generating contribution graph...');
    generateContributionGraph(graphQLData);

    console.log('Generating language card...');
    await generateLanguageCard(sortedLangs);

    console.log('Done! All 3 cohesive cards generated.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
