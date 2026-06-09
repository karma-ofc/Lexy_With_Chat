# Troubleshooting

Короткий FAQ по частым проблемам при запуске:

- Docker: "Docker daemon not running" — запустить Docker Desktop
- Ports busy: проверьте процессы, занимающие порты 3000/3001/5173
- Database errors: убедитесь, что контейнер Postgres поднят и инициализирован

Если обнаружены секреты в коде — удалите их и используйте `.env`.
