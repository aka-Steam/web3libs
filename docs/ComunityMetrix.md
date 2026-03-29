
Кратко, что сделано:

### 1. `analysis/community_api.py`
- Запросы к **GitHub** (`/repos/{owner}/{repo}`): `stargazers_count`, `forks_count`, для «watchers» — `subscribers_count`, иначе `watchers_count`.
- **npm**: `api.npmjs.org/downloads/point/last-week/{package}` и `registry.npmjs.org/{package}` — недельные скачивания, число зависимостей у `latest`, **дата первого релиза** из `time.created` (как разумный аналог npm, а не `created_at` репозитория).
- **`npm_dependents`**: из `community_dependents_overrides.json` или из env вида `NPM_DEPENDENTS_ETHERS` / `NPM_DEPENDENTS_VIEM` (имя пакета в верхнем регистре, `-` → `_`). Без этого — **0** (как в комментарии к React-компоненту).
- Токен: **`GITHUB_TOKEN` или `GH_TOKEN`** для лимита GitHub.

### 2. `analysis/fetch_community_metrics.py`
- CLI: пишет **`analysis/community_metrics.json`** (или путь из `--output`). Удобно без сети в ядре ноутбука.

### 3. Шаблоны
- `community_sources.example.json` — те же `ethers-io/ethers.js` и `wagmi-dev/viem`, что в `MetricsDisplay.tsx`.
- `community_dependents_overrides.example.json` — образец ручных dependents; **реальный файл** должен называться `community_dependents_overrides.json` (пример **не** подхватывается автоматически, чтобы не подставлять чужие цифры).

### 4. `analysis/vkr_metrics_chapter.ipynb`
- В п. 4 описан режим API, overrides и скрипт.
- В коде: флаг **`FETCH_COMMUNITY_FROM_API = True`** и **`get_community_data()`** — сначала API, при ошибке — прежний **`load_community()`** из JSON.
- Предупреждения, если **`npm_dependents == 0`** (напоминание про overrides).

Итог: ноутбук по умолчанию ходит в сеть; при сбое остаётся fallback на `community_metrics.json`; отдельно можно выполнить `python analysis/fetch_community_metrics.py`.