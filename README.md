# kontrol-materialov-hermes

Hermes-ассистент для сайта [**Контроль материалов**](../kontrol-materialov): read-only вопросы через Telegram о объектах, материалах, поставках, работах, просрочках, проблемах и задачах.

**Редактирование данных невозможно** — только чтение через отдельный API сайта.

## Как это работает

```
Telegram → Hermes (WSL) → CLI этого репо → Site API (:3001) → SQLite
                ↑
     config/telegram-users.json
     (Telegram ID → user на сайте)
```

Hermes смотрит на сайт **глазами того, кто написал** — с теми же правами, что у менеджера/админа на сайте.

## Быстрый старт (локально)

### 1. Настройка

```powershell
cd C:\Users\Pehanet25\kontrol-materialov-hermes
copy .env.example .env
copy config\telegram-users.example.json config\telegram-users.json
```

- В `.env` задайте `AGENT_API_TOKEN` (тот же, что на сервере сайта — появится после реализации `/api/agent/*`).
- В `config/telegram-users.json` укажите Telegram ID (через [@userinfobot](https://t.me/userinfobot)) и `site_user_id` из базы сайта.

Проверка связей:

```powershell
npm run check-mapping
```

### 2. Установка skill в Hermes (WSL)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-skill.ps1
```

Перезапуск gateway:

```powershell
wsl -d Ubuntu -e bash -lc "systemctl --user restart hermes-gateway"
```

### 3. Запуск сайта (другой терминал)

```powershell
cd C:\Users\Pehanet25\kontrol-materialov
npm run dev
```

### 4. Тесты

```powershell
npm test
powershell -ExecutionPolicy Bypass -File scripts\test-local.ps1
```

### 5. Ручная проверка CLI

```powershell
node scripts/site-api.mjs health
node scripts/site-api.mjs summary --telegram-id ВАШ_TELEGRAM_ID
```

## Структура

```
kontrol-materialov-hermes/
├── client/site-api-client.mjs   # read-only клиент (4 операции, GET only)
├── config/telegram-users.json   # связь Telegram → сайт (не в git)
├── scripts/
│   ├── site-api.mjs             # CLI для Hermes
│   ├── install-skill.ps1        # установка skill в WSL
│   └── test-local.ps1           # локальные проверки
├── skill/kontrol-materialov/
│   └── SKILL.md                 # инструкции для Hermes
└── tests/client.test.js
```

## Зависимость от сайта

Этот репозиторий **готов**. Для работы нужны маршруты на сайте:

| Метод | URL |
|-------|-----|
| GET | `/api/agent/health` |
| GET | `/api/agent/summary` |
| GET | `/api/agent/projects` |
| GET | `/api/agent/projects/:id/overview` |

Заголовки запроса:

- `X-Agent-Token` — секрет
- `X-Act-As-User` — ID пользователя сайта (из mapping)

Пока API на сайте не реализован, CLI вернёт ошибку — это нормально.

## Безопасность

- Клиент принимает только `http://127.0.0.1:3001` и `http://localhost:3001`
- Только GET, фиксированные 4 операции
- Токен не логируется и не выводится
- Нет в git: `.env`, `config/telegram-users.json`

## GitHub

```powershell
cd C:\Users\Pehanet25\kontrol-materialov-hermes
git init
git add .
git commit -m "Initial Hermes integration for kontrol-materialov"
git remote add origin https://github.com/work4work4end-byte/kontrol-materialov-hermes.git
git push -u origin main
```

(Создайте пустой репозиторий на GitHub перед push.)

## Деплой

- **Hermes** — остаётся на домашнем ПК (WSL + Telegram).
- **Сайт** — деплой на VPS отдельно из `kontrol-materialov`.
- После деплоя сайта можно сменить `SITE_API_BASE_URL` на адрес VPS (добавить URL в allowlist клиента).
