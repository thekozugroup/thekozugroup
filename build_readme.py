import os
import re
import json
import urllib.request
import urllib.error

USERNAME = os.environ.get("GITHUB_USERNAME", "thekozugroup")
TOKEN = os.environ.get("GH_TOKEN", "")


def api_get(endpoint):
    url = f"https://api.github.com/{endpoint}"
    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": f"{USERNAME}-profile"}
    if TOKEN:
        headers["Authorization"] = f"token {TOKEN}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"HTTP error {e.code} on {url}: {e.read().decode()[:200]}")
        return None
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None


def replace_chunk(content, marker, chunk, inline=False):
    r = re.compile(
        r"<!-- {} starts -->.*?<!-- {} ends -->".format(marker, marker),
        re.DOTALL,
    )
    if not inline:
        chunk = "\n{}\n".format(chunk)
    chunk = "<!-- {} starts -->{}<!-- {} ends -->".format(marker, chunk, marker)
    return r.sub(chunk, content)


def fetch_user():
    data = api_get(f"users/{USERNAME}")
    if not data:
        return {"followers": 0, "public_repos": 0}
    return {
        "followers": data.get("followers", 0),
        "public_repos": data.get("public_repos", 0),
    }


def fetch_repos():
    repos = []
    page = 1
    while True:
        batch = api_get(f"users/{USERNAME}/repos?per_page=100&page={page}&sort=updated")
        if not batch:
            break
        for repo in batch:
            if repo.get("fork"):
                continue
            repos.append({
                "name": repo["name"],
                "stars": repo.get("stargazers_count", 0),
                "forks": repo.get("forks_count", 0),
                "language": repo.get("language") or "Unknown",
                "updated": repo.get("updated_at", "")[:10],
                "languages_url": repo["languages_url"],
            })
        if len(batch) < 100:
            break
        page += 1
    return repos


def fetch_languages(repos):
    lang_totals = {}
    total_bytes = 0
    for repo in repos:
        url = repo["languages_url"]
        data = api_get(url.replace("https://api.github.com/", ""))
        if not data:
            continue
        for lang, bytes in data.items():
            lang_totals[lang] = lang_totals.get(lang, 0) + bytes
            total_bytes += bytes
    if total_bytes == 0:
        return []
    sorted_langs = sorted(lang_totals.items(), key=lambda x: x[1], reverse=True)[:6]
    return [
        {"name": lang, "percent": round((bytes / total_bytes) * 100, 1)}
        for lang, bytes in sorted_langs
    ]


def fetch_releases(repos):
    releases = []
    for repo in repos[:10]:  # Check top 10 repos for releases
        releases_data = api_get(f"repos/{USERNAME}/{repo['name']}/releases?per_page=1")
        if releases_data and len(releases_data) > 0:
            rel = releases_data[0]
            if not rel.get("prerelease"):
                releases.append({
                    "repo": repo["name"],
                    "tag": rel.get("tag_name", "release"),
                    "url": rel.get("html_url", ""),
                    "date": rel.get("published_at", "")[:10],
                })
    return sorted(releases, key=lambda x: x["date"], reverse=True)[:5]


if __name__ == "__main__":
    readme = open("README.md").read()
    
    user = fetch_user()
    repos = fetch_repos()
    
    total_stars = sum(r["stars"] for r in repos)
    total_forks = sum(r["forks"] for r in repos)
    
    stats_text = f"""{user['followers']} followers · {total_stars} stars · {total_forks} forks · {user['public_repos']} repos"""
    readme = replace_chunk(readme, "github_stats", stats_text, inline=True)
    
    langs = fetch_languages(repos)
    if langs:
        lang_md = "\n".join([f"• **{l['name']}** — {l['percent']}%" for l in langs])
    else:
        lang_md = "• No language data available"
    readme = replace_chunk(readme, "languages", lang_md)
    
    releases = fetch_releases(repos)
    if releases:
        release_md = "\n".join([
            f"• [{r['repo']} {r['tag']}]({r['url']}) — {r['date']}" 
            for r in releases
        ])
    else:
        release_md = "• No recent releases"
    readme = replace_chunk(readme, "recent_releases", release_md)
    
    open("README.md", "w").write(readme)
    print("README updated successfully.")
