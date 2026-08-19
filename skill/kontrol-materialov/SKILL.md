---
name: kontrol-materialov
description: >-
  Read-only доступ к сайту «Контроль материалов»: объекты, материалы, поставки,
  работы, просрочки, проблемы и задачи. Используй, когда пользователь спрашивает
  о строительных объектах, материалах, сроках, просрочках, проблемах или задачах
  в системе kontrol-materialov.
version: 0.1.0
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [kontrol-materialov, construction, materials, read-only, telegram]
    category: productivity
required_environment_variables:
  - name: AGENT_API_TOKEN
    prompt: "Agent API token (same as on the site server)"
    help: "Set in repo .env — must match AGENT_API_TOKEN on kontrol-materialov server"
    required_for: "read-only site API access"
  - name: SITE_API_BASE_URL
    prompt: "Site API base URL"
    help: "Default http://127.0.0.1:3001 for local dev"
    required_for: "connecting to the site backend"
---

# Контроль материалов — read-only skill

Hermes отвечает на вопросы о данных сайта **глазами конкретного пользователя** (менеджер, админ, глава и т.д.). Редактирование данных **запрещено**.

## Когда использовать

- Вопросы об объектах, материалах, поставках, работах, сроках
- Просрочки заказов, поставок, работ
- Проблемы и задачи (todos)
- «Сколько объектов», «что просрочено», «статус объекта X»

## Доступ пользователя

1. Определи **Telegram ID** отправителя сообщения.
2. Связь Telegram → пользователь сайта в файле `config/telegram-users.json` репозитория `kontrol-materialov-hermes`.
3. Если ID **нет в файле** — ответь: «У вас нет доступа к системе „Контроль материалов“. Обратитесь к администратору.»
4. **Не угадывай** пользователя и **не используй** чужой аккаунт.

## Разрешённые операции (только чтение)

Выполняй **только** через CLI (из корня репозитория `kontrol-materialov-hermes`):

| Команда | Когда |
|---------|-------|
| `node scripts/site-api.mjs health` | Проверка связи с сайтом |
| `node scripts/site-api.mjs summary --telegram-id <ID>` | Общая сводка |
| `node scripts/site-api.mjs projects --telegram-id <ID>` | Список объектов |
| `node scripts/site-api.mjs project-overview --telegram-id <ID> --project-id <N>` | Детали объекта |

**Запрещено:** любые POST/PUT/DELETE, curl с произвольным URL, прямой доступ к SQLite, выдумывание данных.

## Как отвечать пользователю

- Отвечай **человеческим языком**, без JSON и без технических деталей.
- Указывай **дату и время актуальности** из поля `generated_at` ответа API.
- Различай:
  - **«Нет данных»** — API ответил успешно, но список пуст;
  - **«Не удалось получить данные»** — ошибка API или сайт недоступен.
- Если название объекта **неоднозначно** — покажи варианты и попроси уточнить.
- **Не показывай** токены, заголовки, stack trace, внутренние ID без необходимости.
- **Не придумывай** цифры, даты, статусы — только то, что вернул API.

## Процедура ответа

1. `health` — если давно не проверяли или пользователь жалуется на «не работает».
2. По типу вопроса:
   - общее → `summary`
   - список объектов → `projects`
   - конкретный объект → сначала `projects`, найди id по имени, затем `project-overview`
3. Сформируй краткий ответ: факты, просрочки, ответственные (если есть в данных).
4. В конце: «Данные на …» (время из `generated_at`).

## Пример ответа

> На 19.08.2026 06:30 (МСК) у вас 4 активных объекта. Просрочено: 2 заказа материалов, 1 поставка. Критичных проблем: 3. Могу подробнее по конкретному объекту — напишите название.

## Ошибки

| Ситуация | Действие |
|----------|----------|
| `access_denied` | Сообщить об отсутствии доступа |
| HTTP 401 | Проверить AGENT_API_TOKEN (не показывать пользователю) |
| HTTP 404 на объект | «Объект не найден или недоступен вам» |
| ECONNREFUSED | «Сайт сейчас недоступен. Запустите npm run dev на сервере.» |

## Проверка

```bash
node scripts/site-api.mjs health
node scripts/check-mapping.mjs
npm test
```

## Зависимости

- На сайте `kontrol-materialov` должны быть реализованы маршруты `/api/agent/*` (read-only).
- Локально: `npm run dev` в репозитории сайта на порту 3001.
