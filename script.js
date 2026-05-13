const USERNAME = 'thekozugroup';

async function fetchGitHub(endpoint) {
  const res = await fetch(`https://api.github.com/${endpoint}`);
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

function getLangColor(lang) {
  const colors = {
    TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5',
    Rust: '#dea584', Go: '#00ADD8', HTML: '#e34c26', CSS: '#563d7c',
    Java: '#b07219', 'C++': '#f34b7d', Vue: '#41b883', PHP: '#4F5D95',
    Ruby: '#701516', Swift: '#F05138', Shell: '#89e051', 'C#': '#178600',
    Kotlin: '#A97BFF', Dart: '#00B4AB', Scala: '#c22d40', R: '#198CE7',
    'Objective-C': '#438eff', Elixir: '#6e4a7e', Clojure: '#db5855',
    Haskell: '#5e5086', Lua: '#000080', Perl: '#0298c3', Erlang: '#B83998',
    Julia: '#a270ba', OCaml: '#3be133', F: '#b845fc', 'PowerShell': '#012456'
  };
  return colors[lang] || '#6e7681';
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatEventType(type) {
  return type.replace('Event', '').replace(/([A-Z])/g, ' $1').trim();
}

function formatEventPayload(event) {
  switch (event.type) {
    case 'PushEvent': return `Pushed ${event.payload?.size || 0} commit(s)`;
    case 'CreateEvent': return `Created ${event.payload?.ref_type || 'item'}`;
    case 'DeleteEvent': return `Deleted ${event.payload?.ref_type || 'item'}`;
    case 'IssuesEvent': return `${event.payload?.action || 'updated'} an issue`;
    case 'PullRequestEvent': return `${event.payload?.action || 'updated'} PR #${event.payload?.number || '?'}`;
    case 'WatchEvent': return 'Starred this repository';
    case 'ForkEvent': return 'Forked this repository';
    case 'ReleaseEvent': return `Released ${event.payload?.release?.tag_name || 'version'}`;
    case 'PublicEvent': return 'Made repository public';
    case 'MemberEvent': return `${event.payload?.action || 'updated'} a member`;
    default: return 'Activity recorded';
  }
}

async function renderProfile(profile) {
  document.getElementById('avatar').src = profile.avatar_url;
  document.getElementById('avatar').alt = profile.name || profile.login;
  document.getElementById('avatar-fallback').textContent = (profile.name || profile.login)[0].toUpperCase();
  document.getElementById('name').textContent = profile.name || profile.login;
  document.getElementById('login').textContent = `@${profile.login}`;
  document.getElementById('bio').textContent = profile.bio || 'Passionate developer building cool things with code.';
  document.getElementById('repo-count').textContent = profile.public_repos;
  document.getElementById('followers').textContent = profile.followers;
  document.getElementById('following').textContent = profile.following;

  const meta = document.getElementById('meta');
  const items = [];
  
  if (profile.location) {
    items.push(`
      <div class="flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        ${profile.location}
      </div>`);
  }
  
  if (profile.blog) {
    const url = profile.blog.startsWith('http') ? profile.blog : `https://${profile.blog}`;
    items.push(`
      <div class="flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
        <a href="${url}" target="_blank" class="hover:text-primary transition-colors">${profile.blog}</a>
      </div>`);
  }
  
  if (profile.company) {
    items.push(`
      <div class="flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
        ${profile.company}
      </div>`);
  }
  
  items.push(`
    <div class="flex items-center gap-1.5">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
      Joined ${new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
    </div>`);
  
  meta.innerHTML = items.join('');
}

async function renderLanguages(repos) {
  const ownRepos = repos.filter(r => !r.fork);
  const langData = await Promise.all(
    ownRepos.map(async (repo) => {
      try {
        const res = await fetch(repo.languages_url);
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
      percent: parseFloat(((bytes / sum) * 100).toFixed(1)),
      color: getLangColor(name),
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 8);

  const container = document.getElementById('languages');
  container.innerHTML = sorted.map(lang => `
    <div class="space-y-1.5">
      <div class="flex justify-between text-sm">
        <span class="font-medium flex items-center gap-2">
          <span class="w-3 h-3 rounded-full inline-block" style="background-color: ${lang.color}"></span>
          ${lang.name}
        </span>
        <span class="text-muted-foreground">${lang.percent}%</span>
      </div>
      <div class="progress">
        <div class="progress-bar" style="width: ${lang.percent}%; background-color: ${lang.color}"></div>
      </div>
    </div>
  `).join('');
}

async function renderActivity(events) {
  const container = document.getElementById('activity');
  const filtered = events.filter(e => 
    ['PushEvent', 'CreateEvent', 'PullRequestEvent', 'IssuesEvent', 'WatchEvent', 'ForkEvent', 'ReleaseEvent'].includes(e.type)
  ).slice(0, 8);

  container.innerHTML = filtered.map((event, i) => `
    <div>
      <div class="py-3 flex items-start gap-4">
        <div class="mt-1 min-w-[80px]">
          <span class="badge badge-outline text-xs font-mono">${formatEventType(event.type)}</span>
        </div>
        <div class="space-y-1 flex-1">
          <p class="text-sm font-medium leading-none">
            <a href="https://github.com/${event.repo.name}" target="_blank" class="hover:text-primary transition-colors">
              ${event.repo.name}
            </a>
          </p>
          <p class="text-xs text-muted-foreground">
            ${formatEventPayload(event)} • ${formatDate(event.created_at)}
          </p>
        </div>
      </div>
      ${i !== filtered.length - 1 ? '<div class="separator"></div>' : ''}
    </div>
  `).join('');
}

async function renderRepos(repos) {
  const topRepos = repos
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 4);

  document.getElementById('total-stars').textContent = 
    repos.reduce((acc, r) => acc + r.stargazers_count, 0);
  document.getElementById('total-forks').textContent = 
    repos.reduce((acc, r) => acc + r.forks_count, 0);

  const container = document.getElementById('repos');
  container.innerHTML = topRepos.map(repo => `
    <a href="${repo.html_url}" target="_blank" class="group block p-4 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-card">
      <div class="flex items-start justify-between mb-2">
        <div class="font-semibold text-primary group-hover:underline">${repo.name}</div>
        <div class="flex items-center gap-3 text-xs text-muted-foreground">
          <span class="flex items-center gap-1">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z"></path></svg>
            ${repo.stargazers_count}
          </span>
          <span class="flex items-center gap-1">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4a4 4 0 100 8 4 4 0 000-8z"></path><path d="M6 20a6 6 0 0112 0"></path></svg>
            ${repo.forks_count}
          </span>
        </div>
      </div>
      <p class="text-sm text-muted-foreground line-clamp-2 mb-3">${repo.description || 'No description available.'}</p>
      <div class="flex items-center gap-3 text-xs">
        ${repo.language ? `
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full" style="background-color: ${getLangColor(repo.language)}"></span>
            ${repo.language}
          </span>
        ` : ''}
        <span class="text-muted-foreground">Updated ${formatDate(repo.updated_at)}</span>
      </div>
    </a>
  `).join('');
}

async function init() {
  try {
    const [profile, repos, events] = await Promise.all([
      fetchGitHub(`users/${USERNAME}`),
      fetchGitHub(`users/${USERNAME}/repos?per_page=100&sort=updated`),
      fetchGitHub(`users/${USERNAME}/events/public?per_page=30`),
    ]);

    await renderProfile(profile);
    await renderLanguages(repos);
    await renderActivity(events);
    await renderRepos(repos);

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');
  } catch (err) {
    console.error('Failed to load GitHub data:', err);
    document.getElementById('loading').innerHTML = `
      <div class="text-center py-12">
        <p class="text-red-500">Failed to load GitHub data. This might be due to API rate limits.</p>
        <p class="text-sm text-muted-foreground mt-2">Please try again in a few minutes.</p>
      </div>
    `;
  }
}

init();
