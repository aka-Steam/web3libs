# Web3 Test Stand

Тестовый стенд для сравнения библиотек ethers.js и viem (с заглушкой для web3.js) в контексте frontend: RPC-методы, производительность, размер бандла, негативные сценарии.

## Требования

- Node.js 18+
- Для локальной цепи: [Foundry (Anvil)](https://book.getfoundry.sh/getting-started/installation) или запуск RPC по своему URL
- Для E2E с MetaMask: Linux (Synpress не поддерживает Windows)

## Установка

```bash
npm install
```

Опционально установить браузеры Playwright (для E2E):

```bash
npx playwright install chromium
```

## Запуск приложения

```bash
npm run dev
```

Чтобы сразу поднять и приложение, и локальную цепь (Anvil) в одном терминале:

```bash
npm run dev:all
```

Приложение откроется на `http://localhost:5173`. Выбор библиотеки по query-параметру:

- `http://localhost:5173/?lib=ethers` — ethers.js
- `http://localhost:5173/?lib=viem` — viem
- `http://localhost:5173/?lib=web3` — заглушка web3.js (все методы выбросят ошибку)

По умолчанию RPC: `http://127.0.0.1:8545`. Чтобы изменить, создайте `.env`:

```
VITE_RPC_URL=http://127.0.0.1:8545
```

## Локальная цепь (Anvil)

Для бенчмарков и тестов нужен работающий RPC (например, Anvil):

```bash
# Вариант 1: напрямую (если Anvil в PATH)
npm run anvil

# Вариант 2: через скрипт
npm run start-anvil
```

RPC будет доступен на `http://127.0.0.1:8545`.

## Запуск бенчмарков в UI

1. Запустите приложение и Anvil: `npm run dev:all` (или в двух терминалах: `npm run dev` и `npm run anvil`).
2. Откройте в браузере `http://localhost:5173/?lib=ethers` или `/?lib=viem`.
3. В блоке **Benchmark** задайте число повторов (например, 100), при необходимости включите «Include connectWallet».
4. Нажмите **Run benchmark**.
5. Результаты появятся в таблице ниже; кнопка **Export JSON** сохранит их в файл.

Результаты также записываются в `window.__benchmarkResults` (удобно для E2E).

## E2E-тесты (Playwright)



RPC-бенчмарки без MetaMask можно гонять на любой ОС. Если нужно запустить **только RPC e2e-тесты** (без сценариев с MetaMask), используйте один из вариантов:

```bash
# через npx, минуя npm-скрипт
npx playwright test e2e/benchmark-rpc.spec.ts

# или через npm-скрипт с указанием файла теста
npm run test:e2e -- e2e/benchmark-rpc.spec.ts
```

Полный набор тестов доступен только для Linux:
```bash
# Запуск приложения вручную в другом терминале или автоматически (webServer в конфиге)
npm run test:e2e
```

Тесты из `e2e/benchmark-rpc.spec.ts` открывают страницу с ethers/viem, нажимают «Run benchmark» и проверяют наличие `window.__benchmarkResults`. Результаты сохраняются в `e2e-results/rpc-ethers.json` и `e2e-results/rpc-viem.json`. Для прохождения тестов нужен работающий RPC: перед `npm run test:e2e` запустите Anvil в отдельном терминале (`npm run anvil`) или используйте `npm run dev:all` и в другом терминале — `npm run test:e2e`.

Тесты с MetaMask (connectWallet, подтверждение транзакций) требуют **Synpress** и **Linux**:

1. На Ubuntu (или другом дистрибутиве) выполнить один раз: `npx synpress` (сборка кэша кошелька).
2. Запуск: `npm run test:e2e:wallet` или `npx playwright test e2e/benchmark-wallet.spec.ts --headed`.  
   **Важно:** тесты с MetaMask нужно запускать в headed-режиме (с видимым окном браузера), чтобы Synpress мог обрабатывать popup-подтверждения.
3. Для CI (без дисплея): `npm run test:e2e:wallet:ci` (использует xvfb-run).

Тесты с кошельком прогоняются для ethers и viem отдельно; результаты сохраняются в `e2e-results/wallet-ethers.json` и `e2e-results/wallet-viem.json`.

На Windows эти сценарии не выполняются.

### Частые ошибки при настройке E2E

- **Synpress: `No wallet setup files found at .../test/wallet-setup`**  
  - **Причина:** не найдены файлы инициализации кошелька MetaMask для Synpress.  
  - **Решение:** создайте папку `test/wallet-setup` и добавьте хотя бы один файл вида `*.setup.{ts,js,mjs}`. В этом проекте используется `test/wallet-setup/basic.setup.ts`, который импортирует кошелёк по сид-фразе через `defineWalletSetup` из `@synthetixio/synpress`.

- **Synpress: `browserType.launchPersistentContext: Executable doesn't exist at ~/.cache/ms-playwright/chromium-1140/...`**  
  - **Симптомы:** при запуске `npx synpress` выводится рекомендация `npx playwright install`, но после обычного `npx playwright install chromium` ошибка остаётся.  
  - **Причина:** версия Synpress зависит от `playwright-core@1.48.2` и ожидает браузер Chromium ревизии `1140`, а локально скачана только более новая ревизия (например, `chromium-1208`).  
  - **Решение:** дополнительно установить нужную ревизию Chromium под Playwright 1.48.2:
    ```bash
    # один раз на машине разработчика
    npx playwright@1.48.2 install chromium --with-deps
    ```
    Команда скачает Chromium `chromium-1140` в `~/.cache/ms-playwright/chromium-1140/...`, после чего `npx synpress` сможет собрать кэш кошелька без ошибок.

- **Wallet-тесты: `Target page, context or browser has been closed` при `connectToDapp()`**  
  - **Симптомы:** Synpress находит popup MetaMask, но при ожидании загрузки UI страница/контекст закрывается.  
  - **Причина:** известная несовместимость MetaMask (LavaMoat) с headless/виртуальным дисплеем; popup может закрываться до завершения взаимодействия.  
  - **Возможные решения:**  
    1. Запускать тесты на машине с реальным дисплеем (не через SSH без X11).  
    2. Использовать `xvfb-run` с window manager (например, `fluxbox`): `xvfb-run -a fluxbox & sleep 2 && npm run test:e2e:wallet`.  
    3. См. [Synpress Known Issues](https://docs.synpress.io/docs/known-issues) и [CI guide](https://docs.synpress.io/docs/guides/ci).

## Анализ размера бандла

Сборка двух вариантов (только ethers / только viem) и вывод размеров (raw, gzip, brotli):

```bash
npm run run-bundle-analysis
```

Итоги выводятся в консоль и в файл `bundle-analysis.json` в корне проекта.

## Сборка для продакшена

```bash
npm run build
```

Соберётся единое приложение с динамической подгрузкой адаптера по `?lib=`. Отдельные сборки только под ethers или только под viem:

```bash
npm run build:ethers   # выход: dist-ethers/
npm run build:viem    # выход: dist-viem/
```

## Методика измерения метрик

Ниже описано, как снимать каждую метрику, для которой задуман стенд.

### Латентность RPC и инициализации (производительность)

- **Где:** блок **Benchmark** в UI, таблица **Results**, экспорт JSON.
- **Как:** Запустите приложение и Anvil (`npm run dev:all`), откройте `/?lib=ethers` или `/?lib=viem`, задайте число повторов (рекомендуется 100+), нажмите **Run benchmark**.
- **Что получаете:**
  - По каждой RPC-операции (все методы из `rpcOperations`): **mean**, **p95**, **min**, **max** (мс).
  - **Cold start** (мс) — время от начала загрузки адаптера до готовности; выводится в результатах и в экспорте.
  - **connectWallet** (мс) — при включённом «Include connectWallet» замеряется время до получения аккаунтов после `eth_requestAccounts`.
- **Фиксация:** кнопка **Export JSON** сохраняет полный результат (в т.ч. cold start, connectWallet, массив операций со статистикой) для последующего сравнения ethers vs viem.

### Размер бандла

- **Где:** команда `npm run run-bundle-analysis`, файл `bundle-analysis.json`.
- **Как:** Выполните `npm run run-bundle-analysis`. Скрипт собирает два варианта приложения (только ethers и только viem) и считает размеры.
- **Что получаете:** для каждого варианта — размер **raw**, **gzip**, **brotli** (байты); сводка в консоли и JSON в корне проекта. Сравнение двух библиотек по влиянию на объём бандла.

### Нагрузка на CPU и память (ручной сценарий)

Стенд не снимает CPU/память автоматически; метрики снимаются вручную в Chrome DevTools.

**CPU (Performance):**

1. Откройте приложение с выбранной библиотекой (`/?lib=ethers` или `/?lib=viem`).
2. Откройте DevTools → вкладка **Performance**.
3. Нажмите запись (Record), затем в приложении — **Run benchmark** с числом повторов 100+.
4. Дождитесь окончания бенчмарка, остановите запись.
5. Анализируйте: пиковая и средняя загрузка CPU во время массовых RPC-вызовов; сравните профили для ethers и viem при одинаковом сценарии.

**Память (Memory, проверка на утечки):**

1. Откройте DevTools → вкладка **Memory**.
2. Сделайте **Heap snapshot** до нагрузки (страница загружена, бенчмарк не запускали).
3. Выполните один или несколько полных прогонов бенчмарка (например, 2–3 раза по 100 повторов).
4. При необходимости выполните **Collect garbage** (иконка корзины).
5. Сделайте второй **Heap snapshot** после нагрузки.
6. Сравните снимки: рост размера heap, появление отцепленных узлов (detached). Повторите для другой библиотеки в той же последовательности для сопоставимости.

### Обработка ошибок и устойчивость

Стенд не выдаёт числовую оценку «устойчивости»; он даёт сценарии, в которых возникают ошибки. Задача — зафиксировать и сравнить **сообщения и поведение** библиотек для качественной оценки в отчёте.

**Неверный RPC URL:**

1. Откройте приложение (`/?lib=ethers` или `/?lib=viem`).
2. В блоке **Negative / reliability scenarios** нажмите **Wrong RPC URL (http://127.0.0.1:9999)**.
3. В блоке под кнопкой появится текст ошибки. Зафиксируйте его (скриншот или копирование).
4. Повторите для второй библиотеки. Сравните: тип ошибки (собственный класс vs generic Error), наличие кода/категории, понятность сообщения для отладки.

**Смена сети (wallet_switchEthereumChain):**

1. Подключите MetaMask к приложению (при необходимости включите «Include connectWallet» и один раз запустите бенчмарк и подтвердите подключение).
2. В блоке негативных сценариев нажмите **Switch chain (wallet_switchEthereumChain to Anvil)**.
3. Зафиксируйте результат или сообщение об ошибке в UI. Сравните поведение при переключении сети для ethers и viem (если применимо).

**Обрыв сети:**

1. Запустите приложение и Anvil (`npm run dev:all`).
2. Откройте страницу с одной из библиотек, нажмите **Run benchmark**.
3. Пока идёт выполнение (или сразу после старта), остановите Anvil (Ctrl+C в терминале, где он запущен).
4. Ошибки появятся в консоли браузера (и при необходимости в поле `error` в результатах бенчмарка). Зафиксируйте сообщения для ethers и viem.
5. Для повторного теста снова запустите Anvil и при необходимости обновите страницу.

На основе зафиксированных сообщений можно оценить: информативность ошибок, наличие кодов/типов, удобство отладки (см. раздел 3.1 в `metrics.md`).

---

## Кратко по скриптам

| Команда | Описание |
|--------|----------|
| `npm run dev` | Dev-сервер Vite |
| `npm run dev:all` | Приложение и Anvil в одном терминале |
| `npm run build` | Production-сборка |
| `npm run anvil` | Запуск Anvil (локальная цепь) |
| `npm run start-anvil` | Запуск Anvil через node-скрипт |
| `npm run test:e2e` | E2E Playwright (RPC- и wallet-бенчмарки) |
| `npm run run-bundle-analysis` | Анализ размера бандла ethers/viem |

Результаты E2E-бенчмарков сохраняются в `e2e-results/`: `rpc-ethers.json`, `rpc-viem.json`, `wallet-ethers.json`, `wallet-viem.json`.
