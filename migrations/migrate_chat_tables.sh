#!/usr/bin/env bash
# Скрипт для миграции таблиц чата из базы lexy -> база chat
# Перед запуском экспортируйте переменные окружения или отредактируйте ниже:
# export PGHOST=localhost
# export PGUSER=postgres
# export PGPASSWORD=postgres
# export PGPORT=5432
# Пример запуска: PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres ./migrate_chat_tables.sh

set -euo pipefail

LEXY_DB=${LEXY_DB:-lexy}
CHAT_DB=${CHAT_DB:-chat}
DUMP_FILE=${DUMP_FILE:-chat_tables.dump}

# Список таблиц, которые нужно перенести
TABLES=(chat_messages chat_groups chat_group_members)

echo "Создаём дамп таблиц из базы '$LEXY_DB'..."
pg_dump -Fc --no-acl --no-owner -d "$LEXY_DB" ${TABLES[@]/#/-t } -f "$DUMP_FILE"

echo "Восстанавливаем дамп в базе '$CHAT_DB'..."
pg_restore -d "$CHAT_DB" -v "$DUMP_FILE"

echo "Восстановлено. Обратите внимание: если таблицы зависят от пользователей, их нужно синхронизировать вручную." 

echo "Если в исходной базе `chat_groups` использовалась колонка participants (integer[]),
chat-server при старте автоматически мигрирует её в chat_group_members."

echo "Готово. Проверьте данные и перезапустите сервисы."