module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Lexy API',
    version: '1.0.0',
    description: 'Документация основного сервиса Lexy и микросервиса чата.'
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local server' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      AuthRegisterRequest: {
        type: 'object',
        required: ['name', 'username', 'password'],
        example: { name: 'Test User', username: 'testuser', password: 'TestPass123' },
        properties: {
          name: { type: 'string', example: 'Test User' },
          username: { type: 'string', example: 'testuser' },
          password: { type: 'string', example: 'TestPass123' }
        }
      },
      AuthLoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        example: { username: 'testuser', password: 'TestPass123' },
        properties: {
          username: { type: 'string', example: 'testuser' },
          password: { type: 'string', example: 'TestPass123' }
        }
      },
      ProfileUpdateRequest: {
        type: 'object',
        example: { name: 'Updated User', username: 'updated_user', avatar: '👤', notifications_enabled: true },
        properties: {
          name: { type: 'string', example: 'Updated User' },
          username: { type: 'string', example: 'updated_user' },
          avatar: { type: 'string', example: '👤' },
          notifications_enabled: { type: 'boolean', example: true }
        }
      },
      StatsUpdateRequest: {
        type: 'object',
        example: { streak: 7, learned_words: 120, study_time: 5400, accuracy: 87, last_study_date: '2026-05-22' },
        properties: {
          streak: { type: 'integer', example: 7 },
          learned_words: { type: 'integer', example: 120 },
          study_time: { type: 'integer', example: 5400 },
          accuracy: { type: 'integer', example: 87 },
          last_study_date: { type: 'string', format: 'date', example: '2026-05-22' }
        }
      },
      PasswordChangeRequest: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        example: { currentPassword: 'OldPass123', newPassword: 'NewPass123' },
        properties: {
          currentPassword: { type: 'string', example: 'OldPass123' },
          newPassword: { type: 'string', example: 'NewPass123' }
        }
      },
      ActivityRequest: {
        type: 'object',
        required: ['cardsStudied'],
        example: { cardsStudied: 12, date: '2026-05-22' },
        properties: {
          cardsStudied: { type: 'integer', example: 12 },
          date: { type: 'string', format: 'date', example: '2026-05-22' }
        }
      },
      SyncRequest: {
        type: 'object',
        example: { decks: [{ id: 1, name: 'My Deck', description: 'Deck description', cards: [] }] },
        properties: {
          decks: { type: 'array', items: { type: 'object' } }
        }
      },
      DeckCreateRequest: {
        type: 'object',
        required: ['name'],
        example: { name: 'My Deck', description: 'Deck description', source: 'created', public_deck_id: null },
        properties: {
          name: { type: 'string', example: 'My Deck' },
          description: { type: 'string', example: 'Deck description' },
          source: { type: 'string', example: 'created' },
          public_deck_id: { type: 'integer', nullable: true, example: null }
        }
      },
      DeckUpdateRequest: {
        type: 'object',
        example: { name: 'Updated Deck', description: 'Updated description', custom_image: '/api/decks/10/image?t=123' },
        properties: {
          name: { type: 'string', example: 'Updated Deck' },
          description: { type: 'string', example: 'Updated description' },
          custom_image: { type: 'string', nullable: true, example: '/api/decks/10/image?t=123' }
        }
      },
      CardCreateRequest: {
        type: 'object',
        required: ['front', 'back'],
        example: { front: 'hello', back: 'привет' },
        properties: {
          front: { type: 'string', example: 'hello' },
          back: { type: 'string', example: 'привет' }
        }
      },
      CreateGroupRequest: {
        type: 'object',
        required: ['name'],
        example: { name: 'Test Group' },
        properties: {
          name: { type: 'string', example: 'Test Group' }
        }
      },
      ChatUserRequest: {
        type: 'object',
        example: { participantId: 2 },
        properties: {
          participantId: { type: 'integer', example: 2 }
        }
      },
      SendChatMessageRequest: {
        type: 'object',
        required: ['type', 'text'],
        example: { groupId: 1, type: 'text', text: 'Hello from Swagger' },
        properties: {
          recipientId: { type: 'integer', example: 2 },
          groupId: { type: 'integer', example: 1 },
          type: { type: 'string', enum: ['text', 'deck', 'photo'], example: 'text' },
          text: { type: 'string', example: 'Hello from Swagger' },
          reply_to: {
            type: 'object',
            nullable: true,
            example: { id: 15, message_type: 'text', text: 'Previous message' }
          }
        }
      }
    }
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Проверка доступности основного сервиса',
        responses: {
          200: {
            description: 'Сервис доступен',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { ok: { type: 'boolean', example: true } } }
              }
            }
          }
        }
      }
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Регистрация пользователя',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthRegisterRequest' } } } },
        responses: { 200: { description: 'Пользователь создан' }, 400: { description: 'Некорректные данные' } }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Вход в систему',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthLoginRequest' } } } },
        responses: { 200: { description: 'Успешная авторизация' }, 400: { description: 'Неверный логин или пароль' } }
      }
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Получение данных текущего пользователя',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Данные пользователя' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/api/auth/profile': {
      put: {
        tags: ['Auth'],
        summary: 'Обновление профиля пользователя',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProfileUpdateRequest' } } } },
        responses: { 200: { description: 'Профиль обновлён' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/api/auth/stats': {
      get: {
        tags: ['Auth'],
        summary: 'Получение статистики пользователя (только администратор)',
        description: 'Доступно только пользователям с ролью администратора. Не-администраторам возвращается 403.',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Статистика пользователя' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Требуются права администратора' } }
      },
      put: {
        tags: ['Auth'],
        summary: 'Обновление статистики пользователя (только администратор)',
        description: 'Доступно только пользователям с ролью администратора. Токен проверяется на наличие прав админа; не-администраторам возвращается 403. Администратор может обновить статистику для себя.',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/StatsUpdateRequest' } } } },
        responses: { 200: { description: 'Статистика обновлена' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Требуются права администратора' } }
      }
    },
    '/api/auth/password': {
      put: {
        tags: ['Auth'],
        summary: 'Изменение пароля',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PasswordChangeRequest' } } } },
        responses: { 200: { description: 'Пароль изменён' }, 400: { description: 'Неверный текущий пароль' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/api/activity': {
      get: {
        tags: ['Activity'],
        summary: 'Получение активности пользователя',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Данные активности' }, 401: { description: 'Требуется авторизация' } }
      },
      post: {
        tags: ['Activity'],
        summary: 'Сохранение активности пользователя',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ActivityRequest' } } } },
        responses: { 200: { description: 'Активность сохранена' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/api/sync': {
      get: {
        tags: ['Sync'],
        summary: 'Получение данных для синхронизации',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Синхронизируемые данные' }, 401: { description: 'Требуется авторизация' } }
      },
      put: {
        tags: ['Sync'],
        summary: 'Передача данных синхронизации',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SyncRequest' } } } },
        responses: { 200: { description: 'Синхронизация выполнена' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/api/decks': {
      get: {
        tags: ['Decks'],
        summary: 'Получение списка пользовательских колод',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Список колод' }, 401: { description: 'Требуется авторизация' } }
      },
      post: {
        tags: ['Decks'],
        summary: 'Создание новой колоды',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DeckCreateRequest' } } } },
        responses: { 200: { description: 'Колода создана' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/api/decks/{id}': {
      put: {
        tags: ['Decks'],
        summary: 'Редактирование колоды',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1 } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DeckUpdateRequest' } } } },
        responses: { 200: { description: 'Колода обновлена' }, 401: { description: 'Требуется авторизация' } }
      },
      delete: {
        tags: ['Decks'],
        summary: 'Удаление колоды',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1 } }],
        responses: { 200: { description: 'Колода удалена' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/api/decks/{id}/cards': {
      get: {
        tags: ['Cards'],
        summary: 'Получение карточек колоды',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1 } }],
        responses: { 200: { description: 'Список карточек' }, 401: { description: 'Требуется авторизация' } }
      },
      post: {
        tags: ['Cards'],
        summary: 'Создание карточки в колоде',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1 } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CardCreateRequest' } } } },
        responses: { 200: { description: 'Карточка создана' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/api/public-decks': {
      get: {
        tags: ['Public decks'],
        summary: 'Получение публичных колод',
        responses: { 200: { description: 'Публичные колоды' } }
      }
    },
    '/api/public-decks/{id}/cards': {
      get: {
        tags: ['Public decks'],
        summary: 'Получение карточек публичной колоды',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1 } }],
        responses: { 200: { description: 'Карточки публичной колоды' } }
      }
    },
    '/chat-api/health': {
      get: {
        tags: ['Chat'],
        summary: 'Проверка доступности микросервиса чата',
        responses: {
          200: {
            description: 'Сервис доступен',
            content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean', example: true } } } } }
          }
        }
      }
    },
    '/chat-api/groups': {
      get: {
        tags: ['Chat groups'],
        summary: 'Получение групп пользователя',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Список групп' }, 401: { description: 'Требуется авторизация' } }
      },
      post: {
        tags: ['Chat groups'],
        summary: 'Создание группы',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateGroupRequest' } } } },
        responses: { 201: { description: 'Группа создана' }, 400: { description: 'Неверное название группы' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/chat-api/groups/{groupId}/participants': {
      post: {
        tags: ['Chat groups'],
        summary: 'Добавление участника в группу',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'groupId', in: 'path', required: true, schema: { type: 'integer', example: 1 } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatUserRequest' } } } },
        responses: { 200: { description: 'Участник добавлен' }, 400: { description: 'Неверные параметры' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/chat-api/messages': {
      post: {
        tags: ['Chat'],
        summary: 'Отправка сообщения',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SendChatMessageRequest' } } } },
        responses: { 201: { description: 'Сообщение создано' }, 400: { description: 'Ошибка в данных сообщения' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/chat-api/messages/{messageId}': {
      put: {
        tags: ['Chat'],
        summary: 'Редактирование сообщения',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'messageId', in: 'path', required: true, schema: { type: 'integer', example: 10 } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                example: { text: 'Updated message text' },
                properties: { text: { type: 'string', example: 'Updated message text' } }
              }
            }
          }
        },
        responses: { 200: { description: 'Сообщение обновлено' }, 400: { description: 'Неверное сообщение или текст' }, 401: { description: 'Требуется авторизация' } }
      },
      delete: {
        tags: ['Chat'],
        summary: 'Удаление сообщения',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'messageId', in: 'path', required: true, schema: { type: 'integer', example: 10 } }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                example: { deleteFor: 'self' },
                properties: { deleteFor: { type: 'string', enum: ['self', 'all'], example: 'self' } }
              }
            }
          }
        },
        responses: { 200: { description: 'Сообщение удалено' }, 401: { description: 'Требуется авторизация' } }
      }
    }
  }
};
