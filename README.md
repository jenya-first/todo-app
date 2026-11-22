# Список дел: Express + PostgreSQL

Автор: **Костык Евгений Станиславович**, логин Moodle `jenya`.

| | |
|---|---|
| Приложение (API + интерфейс) | https://test-api.maslo-spb.ru/ |
| Копия интерфейса на Helios | https://se.ifmo.ru/~s505999/todo/ |
| СУБД | PostgreSQL 16.8 на VPS Timeweb Cloud |
| Node.js | 24 (Express 5, pg 8) |

## Анализ размещения БД

Проверено 22.11.2026.

| Вариант | СУБД | Стоимость | Хранение и подключение | Моя проверка | Источник |
|---|---|---|---|---|---|
| Timeweb Cloud, VPS (РФ) | Любая, установлен PostgreSQL 16.8 | Только оплата, почасовая; Premium от 1 180 ₽/мес; используемая конфигурация 2 320 ₽/мес (1 vCPU, 2 ГБ, 30 ГБ NVMe, бэкапы, публичный IP) | Объём диска по тарифу; роли, `pg_hba` и открытые порты настраиваю сам | Работает, используется в этой работе | https://timeweb.cloud/services/vds-vps |
| Supabase Free | PostgreSQL | Постоянный бесплатный тариф (не грант) | 500 МБ на проект, 2 активных проекта, пауза после 7 дней неактивности | Сайт доступен, вход работает | https://supabase.com/pricing |
| Helios (факультет) | PostgreSQL 18.3 (FreeBSD), база `studs` на хосте `pg` | Бесплатно для студентов | Доступ по SSH с урезанными правами; БД доступна изнутри Helios, снаружи — только через SSH-туннель под личной учётной записью | Доступ есть: `psql -h pg -d studs` работает | https://se.ifmo.ru |

Варианты отличаются моделью оплаты и степенью контроля. Timeweb — отечественный провайдер: условия прозрачные, но бесплатного тарифа нет, и сервер нужно администрировать самому. Supabase — единственный из трёх вариантов с постоянным бесплатным тарифом, а не временным грантом; управляемый PostgreSQL и прямые строки подключения там есть, но лимиты небольшие. Helios бесплатен, но рассчитан на учебную работу в терминале, а не на размещение внешних сервисов.

**Обоснование выбора.** Бесплатный проект Supabase засыпает после недели без запросов, и тогда на время проверки доступность не гарантирована. БД на Helios доступна, но подключиться к ней извне можно только через туннель под личной учётной записью, а передавать её проверяющему запрещено условиями задания. На собственном VPS Timeweb уже работает PostgreSQL. Для работы в нём выделена отдельная база `todo_hw` и две роли:

- `todo_app` — владелец таблицы, под ней работает приложение;
- `todo_reviewer` — только SELECT/INSERT/UPDATE/DELETE для `tasks`; к другим базам не подключается, CREATE/DROP/ALTER запрещены.

Сервер приложения ходит к БД по локальной сети, а проверяющий подключается снаружи через порт, проброшенный на сервере.

## Проверяемость

Приложение не кэширует данные и при каждом запросе читает таблицу, поэтому изменения, которые проверяющий делает напрямую в БД, сразу видны через API и интерфейс. Учётные данные `todo_reviewer` и токен API переданы преподавателю личным сообщением в Moodle и публично не размещаются. Дело «Итоговая работа 24.10.2026: jenya» с `runId="manual"` создано через интерфейс приложения.

## Структура приложения

Express отдаёт и API, и статический интерфейс из `public/`, поэтому всё доступно по одному HTTPS-адресу. Копии интерфейса на Helios адрес API задаётся в `window.API_BASE`, а домен разрешается в `CORS_ORIGIN`. Приложение запускается в Docker за nginx, который терминирует TLS.

| Файл | Назначение |
|---|---|
| `src/config.js` | Чтение `.env`: токен, логин и ФИО автора, строка подключения |
| `src/app.js` | Маршруты, Bearer-авторизация, CORS, обработка ошибок |
| `src/tasks.js` | CRUD `/api/tasks/` |
| `src/validate.js` | Строгая проверка тел и параметров |
| `src/db.js` | Пул `pg`; ошибки БД → 503 |
| `src/migrate.js` | Применяет `sql/*.sql` при старте (идемпотентно) |

Логин и ФИО берутся только из конфигурации. `id`, `ownerLogin`, `createdAt` и `done=false` задаёт сервер. Токен вводится в интерфейсе и хранится в `sessionStorage`; в исходниках его нет.

## Схема данных

| Поле API | Столбец | Тип |
|---|---|---|
| `id` | `id` | `uuid` PK |
| `ownerLogin` | `owner_login` | `varchar(64)` |
| `title` | `title` | `varchar(200)`, CHECK 1–200 после trim |
| `done` | `done` | `boolean`, по умолчанию `false` |
| `runId` | `run_id` | `varchar(64)`, CHECK `^[A-Za-z0-9_-]{1,64}$` |
| `createdAt` | `created_at` | `timestamptz`, в API ISO 8601 UTC |

## Установка и запуск

```sh
npm ci
cp .env.example .env
npm run migrate
npm start
```

Docker (сеть `mydockernet` уже существует на сервере):

```sh
docker build -t jenya00/todo-express:1.0.0 .
docker push jenya00/todo-express:1.0.0
docker compose pull && docker compose up -d
```

Инициализация БД (от администратора):

```sql
CREATE ROLE todo_app LOGIN PASSWORD '...';
CREATE DATABASE todo_hw OWNER todo_app;
REVOKE ALL ON DATABASE todo_hw FROM PUBLIC;
GRANT CONNECT ON DATABASE todo_hw TO todo_app;
```

Роль проверяющего (после первого запуска, когда таблица создана):

```sql
CREATE ROLE todo_reviewer LOGIN PASSWORD '...' NOINHERIT;
GRANT CONNECT ON DATABASE todo_hw TO todo_reviewer;
GRANT USAGE ON SCHEMA public TO todo_reviewer;
GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO todo_reviewer;
```

## API

Все `/api/` требуют `Authorization: Bearer <токен>`.

| Запрос | Ответ |
|---|---|
| `GET /login/` | 200, `text/plain`, без токена |
| `GET /api/author/` | 200 `{login, fullName}` |
| `POST /api/tasks/` | 201, тело `{title, runId}` |
| `GET /api/tasks/?runId=` | 200, массив |
| `GET` / `PATCH` / `DELETE /api/tasks/:id/` | 200 / 200 / 204; 404 если дела нет |

Ошибки: 400 (валидация, JSON, UUID), 401, 404, 503 (БД); тело `{"error": "..."}`.
