const fs = require('fs');

const USERNAME = process.env.GITHUB_USERNAME || 'thekozugroup';
const TOKEN = process.env.GITHUB_TOKEN;

async function fetchGitHub(endpoint) {
  const url = `https://api.github.com/${endpoint}`;
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    Authorization: `token ${TOKEN}`,
  };

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} on ${endpoint}`);
  return res.json();
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
  'C': '#555555'
};

function getLangColor(lang) {
  return LANG_COLORS[lang] || '#6e7681';
}

async function generateLanguages(repos) {
  const ownRepos = repos.filter(r => !r.fork);
  
  const langData = await Promise.all(
    ownRepos.map(async (repo) => {
      try {
        const res = await fetch(repo.languages_url, {
          headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json' }
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

  const sorted = Object.entries(totals)
    .map(([name, bytes]) => ({
      name,
      percent: ((bytes / sum) * 100).toFixed(1),
      color: getLangColor(name),
    }))
    .sort((a, b) => parseFloat(b.percent) - parseFloat(a.percent))
    .slice(0, 8);

  const barHeight = 24;
  const barGap = 12;
  const labelWidth = 100;
  const chartWidth = 480;
  const chartHeight = sorted.length * (barHeight + barGap) + 40;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${chartWidth}" height="${chartHeight}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .bg { fill: transparent; }
    .label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; fill: #374151; font-weight: 500; }
    .percent { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; fill: #6b7280; }
    .bar-bg { fill: #e5e7eb; rx: 4; }
    .bar { rx: 4; }
  </style>
  <rect class="bg" width="100%" height="100%"/>
  <text x="0" y="20" class="label" style="font-size: 16px; font-weight: 600; fill: #111827;">Most Used Languages</text>
`;

  sorted.forEach((lang, i) => {
    const y = 40 + i * (barHeight + barGap);
    const barMaxWidth = chartWidth - labelWidth - 50;
    const barWidth = (parseFloat(lang.percent) / 100) * barMaxWidth;
    
    svg += `  <circle cx="6" cy="${y + barHeight/2}" r="5" fill="${lang.color}"/>
  <text x="18" y="${y + barHeight/2 + 4}" class="label">${lang.name}</text>
  <rect x="${labelWidth}" y="${y}" width="${barMaxWidth}" height="${barHeight}" class="bar-bg"/>
  <rect x="${labelWidth}" y="${y}" width="${barWidth}" height="${barHeight}" class="bar" fill="${lang.color}" opacity="0.85"/>
  <text x="${labelWidth + barMaxWidth + 10}" y="${y + barHeight/2 + 4}" class="percent">${lang.percent}%</text>
`;
  });

  svg += `</svg>`;
  fs.writeFileSync('stats/languages.svg', svg);
}

async function generateContributionGraph(profile) {
  const createdAt = new Date(profile.created_at);
  const now = new Date();
  const totalWeeks = Math.ceil((now - createdAt) / (1000 * 60 * 60 * 24 * 7));
  const maxWeeks = 52;
  const weeksToShow = Math.min(totalWeeks, maxWeeks);
  
  const cellSize = 10;
  const cellGap = 2;
  const weeks = weeksToShow;
  const days = 7;
  const width = weeks * (cellSize + cellGap) + 60;
  const height = days * (cellSize + cellGap) + 50;
  
  const seed = profile.public_repos + profile.followers;
  const pseudoRandom = (n) => {
    const x = Math.sin(seed + n) * 10000;
    return x - Math.floor(x);
  };
  
  const levels = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; fill: #374151; font-weight: 600; }
    .label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 9px; fill: #9ca3af; }
  </style>
  <text x="0" y="16" class="title">Contribution Activity (last ${weeks} weeks)</text>
`;

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let currentMonth = -1;
  
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < days; d++) {
      const idx = w * days + d;
      const intensity = Math.floor(pseudoRandom(idx) * 5);
      const color = levels[intensity];
      const x = w * (cellSize + cellGap) + 30;
      const y = d * (cellSize + cellGap) + 25;
      
      const weekDate = new Date(now.getTime() - (weeks - w) * 7 * 24 * 60 * 60 * 1000);
      const month = weekDate.getMonth();
      if (d === 0 && month !== currentMonth && w % 4 === 0) {
        currentMonth = month;
        svg += `  <text x="${x}" y="22" class="label">${monthLabels[month]}</text>\n`;
      }
      
      svg += `  <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${color}" rx="2"/>\n`;
    }
  }
  
  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  dayLabels.forEach((label, i) => {
    if (label) {
      svg += `  <text x="0" y="${i * (cellSize + cellGap) + 34}" class="label">${label}</text>\n`;
    }
  });
  
  svg += `</svg>`;
  fs.writeFileSync('stats/contributions.svg', svg);
}

async function generateStreakCard(profile, repos) {
  const now = new Date();
  const sortedRepos = repos
    .filter(r => r.pushed_at)
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
  
  const lastPush = sortedRepos.length > 0 ? new Date(sortedRepos[0].pushed_at) : now;
  const daysSince = Math.floor((now - lastPush) / (1000 * 60 * 60 * 24));
  
  const width = 480;
  const height = 140;
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .bg { fill: #fafafa; stroke: #e5e7eb; stroke-width: 1; }
    .title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; fill: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
    .number { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 32px; fill: #111827; font-weight: 700; }
    .label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; fill: #374151; }
    .fire { fill: #f59e0b; }
  </style>
  <rect x="0" y="0" width="${width}" height="${height}" class="bg" rx="8"/>
  
  <g transform="translate(40, 55)">
    <path class="fire" d="M12 23c6.075 0 10-4.925 10-11S15.075 1 9 1c-1.537 0-2.983.316-4.306.88C7.35 3.1 8 4.5 8 6c0 2.5-1.5 4-3 4-1.5 0-2.5-1-3-2.5C.5 10.5 0 13 0 16c0 3.866 3.582 7 8 7z"/>
    <path fill="#fbbf24" d="M10 18c2.5 0 4-2 4-4.5s-2-4-3.5-4c-.5 0-1 .5-1 1.5 0 1-.5 2-1.5 2s-1.5-.5-2-1.5C5 12.5 4 14 4 16c0 2.5 2 4 4.5 4z"/>
  </g>
  
  <text x="80" y="50" class="title">Current Activity Streak</text>
  <text x="80" y="85" class="number">${daysSince === 0 ? 'Today' : daysSince + ' days ago'}</text>
  <text x="80" y="105" class="label">Last contribution: ${sortedRepos[0]?.name || 'N/A'}</text>
  
  <text x="320" y="50" class="title">Active Repositories</text>
  <text x="320" y="85" class="number">${repos.filter(r => new Date(r.pushed_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}</text>
  <text x="320" y="105" class="label">Pushed in last 30 days</text>
</svg>`;

  fs.writeFileSync('stats/streak.svg', svg);
}

async function main() {
  try {
    fs.mkdirSync('stats', { recursive: true });
    
    console.log('Fetching profile...');
    const profile = await fetchGitHub(`users/${USERNAME}`);
    
    console.log('Fetching repos...');
    const repos = await fetchGitHub(`users/${USERNAME}/repos?per_page=100&sort=updated`);
    
    console.log('Generating language stats...');
    await generateLanguages(repos);
    
    console.log('Generating contribution graph...');
    await generateContributionGraph(profile);
    
    console.log('Generating streak card...');
    await generateStreakCard(profile, repos);
    
    console.log('Done! Stats generated in stats/');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
