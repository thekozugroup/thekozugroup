import os
import re
import datetime
from github import Github

TOKEN = os.environ.get("GH_TOKEN", "")
USERNAME = os.environ.get("GITHUB_USERNAME", "thekozugroup")

def replace_chunk(content, marker, chunk, inline=False):
    r = re.compile(
        r"<<!-- {} starts -->.*<<!-- {} ends -->".format(marker, marker),
        re.DOTALL,
    )
    if not inline:
        chunk = "\n{}\n".format(chunk)
    chunk = "<!-- {} starts -->{}<!-- {} ends -->".format(marker, chunk, marker)
    return r.sub(chunk, content)


def fetch_github_stats():
    g = Github(TOKEN)
    user = g.get_user(USERNAME)
    
    total_stars = 0
    total_forks = 0
    repos = []
    
    for repo in user.get_repos(type='owner'):
        if not repo.fork:
            total_stars += repo.stargazers_count
            total_forks += repo.forks_count
            repos.append({
                'name': repo.name,
                'stars': repo.stargazers_count,
                'forks': repo.forks_count,
                'language': repo.language,
                'updated': repo.updated_at.strftime("%Y-%m-%d"),
            })
    
    return {
        'followers': user.followers,
        'stars': total_stars,
        'forks': total_forks,
        'repos': len(list(user.get_repos(type='owner'))),
        'top_repos': sorted(repos, key=lambda x: x['stars'], reverse=True)[:4]
    }


def fetch_languages():
    g = Github(TOKEN)
    user = g.get_user(USERNAME)
    lang_totals = {}
    total_bytes = 0
    
    for repo in user.get_repos(type='owner'):
        if repo.fork:
            continue
        try:
            langs = repo.get_languages()
            for lang, bytes in langs.items():
                lang_totals[lang] = lang_totals.get(lang, 0) + bytes
                total_bytes += bytes
        except:
            pass
    
    sorted_langs = sorted(
        [(lang, bytes) for lang, bytes in lang_totals.items()],
        key=lambda x: x[1],
        reverse=True
    )[:6]
    
    result = []
    for lang, bytes in sorted_langs:
        result.append({
            'name': lang,
            'percent': round((bytes / total_bytes) * 100, 1)
        })
    
    return result


def fetch_releases():
    g = Github(TOKEN)
    user = g.get_user(USERNAME)
    releases = []
    
    for repo in user.get_repos(type='owner'):
        if repo.fork or repo.private:
            continue
        try:
            latest = repo.get_latest_release()
            if latest and not latest.prerelease:
                releases.append({
                    'repo': repo.name,
                    'tag': latest.tag_name,
                    'url': latest.html_url,
                    'date': latest.published_at.strftime("%Y-%m-%d")
                })
        except:
            pass
    
    return sorted(releases, key=lambda x: x['date'], reverse=True)[:5]


if __name__ == "__main__":
    readme = open("README.md").read()
    
    stats = fetch_github_stats()
    langs = fetch_languages()
    releases = fetch_releases()
    
    # Stats
    stats_text = f"""{stats['followers']} followers · {stats['stars']} stars · {stats['forks']} forks · {stats['repos']} repos"""
    readme = replace_chunk(readme, "github_stats", stats_text, inline=True)
    
    # Languages
    if langs:
        lang_md = "\n".join([f"• **{l['name']}** — {l['percent']}%" for l in langs])
    else:
        lang_md = "• No language data available"
    readme = replace_chunk(readme, "languages", lang_md)
    
    # Releases
    if releases:
        release_md = "\n".join([
            f"• [{r['repo']} {r['tag']}]({r['url']}) — {r['date']}" 
            for r in releases
        ])
    else:
        release_md = "• No recent releases"
    readme = replace_chunk(readme, "recent_releases", release_md)
    
    open("README.md", "w").write(readme)
