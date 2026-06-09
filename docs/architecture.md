# Архитектура проекта Lexy with Chat

Краткое описание архитектуры и связей между сервисами.

- Frontend (React + Vite) — пользовательский интерфейс, общается с основным API и chat API
- Main API (Node.js + Express) — REST API для пользователей, колод и статистики
- Chat API (Node.js + Socket.IO) — WebSocket-сервис для реального времени
- PostgreSQL — две базы данных: `lexy` (основная) и `chat` (сообщения)
- Docker Compose — оркестрация сервисов в локальной среде

Сервисы общаются по HTTP/WS и используют JWT для аутентификации.
