# API: Chat Server

Список основных эндпоинтов chat-сервиса (`/chat-api`).

Примеры:

- `GET /chat-api/health` — проверка статуса
- `GET /chat-api/threads` — список чат-потоков
- `GET /chat-api/messages?threadId=` — сообщения потока
- `POST /chat-api/messages` — отправка сообщения
- WebSocket: события `chat:new_message`, `chat:ready`, `chat:mark_read`
