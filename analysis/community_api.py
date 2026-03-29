"""
Загрузка метрик сообщества через публичные API GitHub и npm (только стандартная библиотека).

Логика соответствует web3-tools MetricsDisplay.tsx:
- GitHub: GET /repos/{owner}/{repo}
- npm: downloads за неделю + registry metadata для зависимостей и даты первой публикации

npm dependents в публичном API не отдаётся надёжно — подставляются из overrides-файла или env.
"""

from __future__ import annotations

import json
import os
import urllib.request
import warnings
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_SOURCES: list[dict[str, str]] = [
    {"key": "ethers", "owner": "ethers-io", "repo": "ethers.js", "npm_package": "ethers"},
    {"key": "viem", "owner": "wagmi-dev", "repo": "viem", "npm_package": "viem"},
]


def _http_get_json(url: str, headers: dict[str, str] | None = None, timeout: float = 45.0) -> Any:
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _github_headers() -> dict[str, str]:
    h = {"Accept": "application/vnd.github+json", "User-Agent": "playground_v2-community-metrics"}
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def fetch_github_repo(owner: str, repo: str) -> dict[str, Any]:
    url = f"https://api.github.com/repos/{owner}/{repo}"
    return _http_get_json(url, headers=_github_headers())


def fetch_npm_downloads_last_week(package: str) -> int:
    url = f"https://api.npmjs.org/downloads/point/last-week/{package}"
    data = _http_get_json(url)
    return int(data.get("downloads", 0))


def fetch_npm_registry(package: str) -> dict[str, Any]:
    url = f"https://registry.npmjs.org/{package}"
    return _http_get_json(url)


def _npm_first_release_date_iso(meta: dict[str, Any]) -> str | None:
    t = meta.get("time") or {}
    created = t.get("created")
    if not created:
        return None
    # "2015-10-27T01:23:45.678Z"
    return str(created)[:10]


def _npm_dependencies_count(meta: dict[str, Any]) -> int:
    tags = meta.get("dist-tags") or {}
    latest = tags.get("latest")
    if not latest:
        return 0
    ver = (meta.get("versions") or {}).get(latest) or {}
    deps = ver.get("dependencies") or {}
    return len(deps) if isinstance(deps, dict) else 0


def load_sources_map(analysis_dir: Path, library_keys: list[str]) -> dict[str, dict[str, str]]:
    path = analysis_dir / "community_sources.json"
    ex = analysis_dir / "community_sources.example.json"
    src = path if path.exists() else (ex if ex.exists() else None)
    if not src:
        by_key = {d["key"]: d for d in DEFAULT_SOURCES}
        return {k: by_key[k] for k in library_keys if k in by_key}

    raw = json.loads(src.read_text(encoding="utf-8"))
    out: dict[str, dict[str, str]] = {}
    for lib in library_keys:
        row = raw.get(lib)
        if not row:
            continue
        out[lib] = {
            "key": lib,
            "owner": str(row.get("github_owner") or row.get("owner", "")),
            "repo": str(row.get("github_repo") or row.get("repo", "")),
            "npm_package": str(row.get("npm_package") or row.get("package", lib)),
        }
    return out


def load_dependents_overrides(analysis_dir: Path) -> tuple[dict[str, int], bool]:
    """
    Сначала community_dependents_overrides.json, иначе — .example.json
    (как community_metrics / community_metrics.example.json).
    Второй элемент кортежа: True, если подставлен именно example-файл.
    """
    path = analysis_dir / "community_dependents_overrides.json"
    ex = analysis_dir / "community_dependents_overrides.example.json"
    p = path if path.exists() else (ex if ex.exists() else None)
    if not p:
        return {}, False
    raw = json.loads(p.read_text(encoding="utf-8"))
    out: dict[str, int] = {}
    for k, v in raw.items():
        if str(k).startswith("_"):
            continue
        try:
            out[str(k)] = int(v)
        except (TypeError, ValueError):
            pass
    used_example = p.name == "community_dependents_overrides.example.json"
    return out, used_example


def fetch_metrics_for_lib(
    owner: str,
    repo: str,
    npm_package: str,
    dependents_override: int | None,
) -> dict[str, Any]:
    gh = fetch_github_repo(owner, repo)
    stars = int(gh.get("stargazers_count", 0))
    forks = int(gh.get("forks_count", 0))
    # «Наблюдатели» в смысле подписчиков на уведомления репозитория
    watchers = int(gh.get("subscribers_count") or gh.get("watchers_count") or 0)

    downloads = fetch_npm_downloads_last_week(npm_package)
    meta = fetch_npm_registry(npm_package)
    deps_count = _npm_dependencies_count(meta)
    first_iso = _npm_first_release_date_iso(meta)

    dependents = dependents_override
    if dependents is None:
        env_key = f"NPM_DEPENDENTS_{npm_package.upper().replace('-', '_')}"
        raw = os.environ.get(env_key)
        if raw is not None:
            try:
                dependents = int(raw)
            except ValueError:
                dependents = None
    if dependents is None:
        dependents = 0

    return {
        "github_stars": stars,
        "github_forks": forks,
        "github_watchers": watchers,
        "npm_weekly_downloads": downloads,
        "npm_dependents": dependents,
        "npm_dependencies": deps_count,
        "first_release_date": first_iso,
    }


def fetch_community_metrics(
    library_keys: list[str],
    analysis_dir: Path,
    *,
    reference_date: date | None = None,
) -> dict[str, Any]:
    """
    Возвращает словарь как в community_metrics.json: ключи библиотек + _collected_at (ISO date).
    """
    sources = load_sources_map(analysis_dir, library_keys)
    dep_ov, dep_from_example = load_dependents_overrides(analysis_dir)
    if dep_from_example:
        warnings.warn(
            "Используется community_dependents_overrides.example.json — для актуальных dependents "
            "скопируйте в community_dependents_overrides.json и подставьте свои числа.",
            stacklevel=2,
        )
    collected = datetime.now(timezone.utc).date().isoformat()
    out: dict[str, Any] = {"_collected_at": collected}
    missing: list[str] = []

    for lib in library_keys:
        spec = sources.get(lib)
        if not spec:
            missing.append(lib)
            continue
        row = fetch_metrics_for_lib(
            spec["owner"],
            spec["repo"],
            spec["npm_package"],
            dep_ov.get(lib),
        )
        out[lib] = row

    if missing:
        out["_sources_missing"] = missing
    if reference_date is not None:
        out["_reference_date_note"] = str(reference_date)
    return out
