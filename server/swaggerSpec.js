module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Lexy API',
    version: '1.0.0',
    description: 'Документация основного сервиса Lexy и микросервиса чата. В Swagger попадают только публичные рабочие API, служебные internal-маршруты (/chat-api/internal/*) не включены.'
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local server' }],
  tags: [
    { name: 'System', description: 'Проверка доступности сервисов' },
    { name: 'Notifications', description: 'Пуш-уведомления и подписки' },
    { name: 'Dictionary', description: 'Переводы текста' },
    { name: 'Auth', description: 'Аутентификация и профиль пользователя' },
    { name: 'Activity', description: 'Активность и статистика пользователя' },
    { name: 'Sync', description: 'Синхронизация данных' },
    { name: 'Chat', description: 'Личные сообщения и диалоги' },
    { name: 'Chat groups', description: 'Управление групповыми чатами' },
    { name: 'Decks', description: 'Пользовательские колоды' },
    { name: 'Cards', description: 'Карточки' },
    { name: 'Admin', description: 'Административные действия' },
    { name: 'Public decks', description: 'Публичные колоды' }
  ],
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
      DeckSubmitRequest: {
        type: 'object',
        example: { message: 'Прошу опубликовать колоду' },
        properties: {
          message: { type: 'string', example: 'Прошу опубликовать колоду' }
        }
      },
      BanUserRequest: {
        type: 'object',
        example: { until: 'forever', reason: 'Нарушение правил' },
        properties: {
          until: { type: 'string', nullable: true, example: 'forever' },
          reason: { type: 'string', example: 'Нарушение правил' }
        }
      },
      SubmissionReviewRequest: {
        type: 'object',
        required: ['action'],
        example: { action: 'approve', category: 'Vocabulary', lang: 'Английский' },
        properties: {
          action: { type: 'string', enum: ['approve', 'reject'], example: 'approve' },
          category: { type: 'string', example: 'Vocabulary' },
          lang: { type: 'string', example: 'Английский' },
          rejection_reason: { type: 'string', nullable: true, example: 'Некорректный контент' }
        }
      },
      CardUpdateRequest: {
        type: 'object',
        example: { front: 'updated front', back: 'updated back', is_favorite: true, is_forgotten: false },
        properties: {
          front: { type: 'string', example: 'updated front' },
          back: { type: 'string', example: 'updated back' },
          is_favorite: { type: 'boolean', example: true },
          is_forgotten: { type: 'boolean', example: false }
        }
      },
      CardForgottenRequest: {
        type: 'object',
        example: { is_forgotten: true },
        properties: {
          is_forgotten: { type: 'boolean', example: true }
        }
      },
      PushSubscriptionRequest: {
        type: 'object',
        required: ['endpoint', 'keys'],
        example: {
          endpoint: 'https://example.com/push-service/send',
          keys: { p256dh: '...', auth: '...' }
        },
        properties: {
          endpoint: { type: 'string', example: 'https://example.com/push-service/send' },
          keys: {
            type: 'object',
            properties: {
              p256dh: { type: 'string', example: '...' },
              auth: { type: 'string', example: '...' }
            }
          }
        }
      },
      DictionaryTranslateResponse: {
        type: 'object',
        example: { translation: 'привет', alternatives: ['здравствуйте', 'хай'] },
        properties: {
          translation: { type: 'string', example: 'привет' },
          alternatives: { type: 'array', items: { type: 'string' }, example: ['здравствуйте', 'хай'] }
        }
      },
      PublicDeckCreateRequest: {
        type: 'object',
        required: ['name'],
        example: { name: 'Public Deck', description: 'Описание', lang: 'Английский', category: 'Vocabulary' },
        properties: {
          name: { type: 'string', example: 'Public Deck' },
          description: { type: 'string', example: 'Описание' },
          lang: { type: 'string', example: 'Английский' },
          category: { type: 'string', example: 'Vocabulary' }
        }
      },
      PublicDeckUpdateRequest: {
        type: 'object',
        example: { name: 'Updated public deck', description: 'Новое описание', lang: 'Русский', category: 'Grammar' },
        properties: {
          name: { type: 'string', example: 'Updated public deck' },
          description: { type: 'string', example: 'Новое описание' },
          lang: { type: 'string', example: 'Русский' },
          category: { type: 'string', example: 'Grammar' },
          custom_image: { type: 'string', nullable: true, example: '/api/decks/10/image?t=123' }
        }
      },
      GroupUpdateRequest: {
        type: 'object',
        required: ['name'],
        example: { name: 'Updated Group' },
        properties: {
          name: { type: 'string', example: 'Updated Group' }
        }
      },
      DeleteChatMessageRequest: {
        type: 'object',
        example: { deleteFor: 'self' },
        properties: {
          deleteFor: { type: 'string', enum: ['self', 'all'], example: 'self' }
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
    '/api/notifications/public-key': {
      get: {
        tags: ['Notifications'],
        summary: 'Публичный ключ веб-пуша',
        responses: {
          200: {
            description: 'Публичный ключ',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { publicKey: { type: 'string' } } }
              }
            }
          }
        }
      }
    },
    '/api/notifications/subscribe': {
      post: {
        tags: ['Notifications'],
        summary: 'Подписка на push-уведомления',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                example: { endpoint: 'https://example.com', keys: { p256dh: '...', auth: '...' } },
                properties: { endpoint: { type: 'string' }, keys: { type: 'object' } }
              }
            }
          }
        },
        responses: { 201: { description: 'Подписка сохранена' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/api/notifications/test': {
      post: {
        tags: ['Notifications'],
        summary: 'Отправка тестового уведомления',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Уведомление отправлено' }, 400: { description: 'Уведомления отключены или нет подписок' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/api/dictionary/translate': {
      get: {
        tags: ['Dictionary'],
        summary: 'Перевод текста через внешний сервис',
        parameters: [
          { name: 'text', in: 'query', required: true, schema: { type: 'string', example: 'hello' }, description: 'Текст для перевода' },
          { name: 'lang', in: 'query', required: false, schema: { type: 'string', example: 'en-ru', enum: ['en-ru', 'ru-en'] }, description: 'Направление перевода' }
        ],
        responses: {
          200: {
            description: 'Результат перевода',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/DictionaryTranslateResponse' } } }
          },
          400: { description: 'Некорректные параметры' },
          502: { description: 'Ошибка внешнего сервиса' }
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
    '/api/auth/account': {
      delete: {
        tags: ['Auth'],
        summary: 'Удаление аккаунта пользователя',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Аккаунт удалён' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Админ не может удалить свой профиль' } }
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
    '/api/chat/users': {
      get: {
        tags: ['Chat'],
        summary: 'Получение пользователей для чата',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Список пользователей' }, 401: { description: 'Требуется авторизация' } }
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
    '/api/decks/{id}/submit': {
      post: {
        tags: ['Decks'],
        summary: 'Отправка колоды на публикацию',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1 } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DeckSubmitRequest' } } } },
        responses: { 201: { description: 'Заявка создана' }, 400: { description: 'Ошибка данных' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Нет доступа' } }
      }
    },
    '/api/decks/{id}/add': {
      post: {
        tags: ['Decks'],
        summary: 'Добавление публичной колоды в личный список',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 10 } }],
        responses: { 200: { description: 'Колода добавлена' }, 400: { description: 'Колода не найдена или уже добавлена' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/api/decks/{id}/image': {
      post: {
        tags: ['Decks'],
        summary: 'Загрузка изображения для колоды',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1 } }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  image: { type: 'string', format: 'binary' }
                },
                required: ['image']
              }
            }
          }
        },
        responses: { 200: { description: 'Изображение загружено' }, 400: { description: 'Изображение не загружено' }, 401: { description: 'Требуется авторизация' } }
      },
      get: {
        tags: ['Decks'],
        summary: 'Получение изображения колоды',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1 } }],
        responses: { 200: { description: 'Изображение колоды', content: { 'image/*': { schema: { type: 'string', format: 'binary' } } } }, 404: { description: 'Изображение не найдено' } }
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
    '/api/cards/{id}/favorite': {
      put: {
        tags: ['Cards'],
        summary: 'Переключение статуса избранной карточки',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 123 } }],
        responses: { 200: { description: 'Статус обновлён' }, 401: { description: 'Требуется авторизация' }, 404: { description: 'Карточка не найдена' } }
      }
    },
    '/api/cards/favorites': {
      get: {
        tags: ['Cards'],
        summary: 'Получение избранных карточек',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Список избранных карточек' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/api/cards/{id}/forgotten': {
      put: {
        tags: ['Cards'],
        summary: 'Отметить/снять отметку как забытая карточка',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 123 } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CardForgottenRequest' } } } },
        responses: { 200: { description: 'Статус обновлён' }, 401: { description: 'Требуется авторизация' }, 404: { description: 'Карточка не найдена' } }
      }
    },
    '/api/cards/forgotten': {
      get: {
        tags: ['Cards'],
        summary: 'Получение забытых карточек',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Список забытых карточек' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/api/cards/{id}': {
      put: {
        tags: ['Cards'],
        summary: 'Обновление карточки',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 123 } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CardUpdateRequest' } } } },
        responses: { 200: { description: 'Карточка обновлена' }, 400: { description: 'Нет данных для обновления' }, 401: { description: 'Требуется авторизация' }, 404: { description: 'Карточка не найдена' } }
      },
      delete: {
        tags: ['Cards'],
        summary: 'Удаление карточки',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 123 } }],
        responses: { 200: { description: 'Карточка удалена' }, 401: { description: 'Требуется авторизация' }, 404: { description: 'Карточка не найдена' } }
      }
    },
    '/api/admin/submissions': {
      get: {
        tags: ['Admin'],
        summary: 'Список заявок на публикацию колод',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Список заявок' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Требуются права администратора' } }
      }
    },
    '/api/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'Список пользователей',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Список пользователей' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Требуются права администратора' } }
      }
    },
    '/api/admin/users/{id}/ban': {
      put: {
        tags: ['Admin'],
        summary: 'Блокировка или разблокировка пользователя',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 5 } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BanUserRequest' } } } },
        responses: { 200: { description: 'Пользователь обновлён' }, 400: { description: 'Неверные данные' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Требуются права администратора' }, 404: { description: 'Пользователь не найден' } }
      }
    },
    '/api/admin/users/{id}/role': {
      put: {
        tags: ['Admin'],
        summary: 'Смена роли пользователя',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 5 } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['role'], example: { role: 'admin' }, properties: { role: { type: 'string', example: 'admin' } } } } } },
        responses: { 200: { description: 'Роль пользователя обновлена' }, 400: { description: 'Неверная роль' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Требуются права администратора' } }
      }
    },
    '/api/admin/public-decks': {
      get: {
        tags: ['Admin'],
        summary: 'Получение публичных колод в админке',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Список публичных колод' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Требуются права администратора' } }
      },
      post: {
        tags: ['Admin'],
        summary: 'Создание публичной колоды',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicDeckCreateRequest' } } } },
        responses: { 200: { description: 'Публичная колода создана' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Требуются права администратора' } }
      }
    },
    '/api/admin/public-decks/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Обновление публичной колоды',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 10 } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicDeckUpdateRequest' } } } },
        responses: { 200: { description: 'Публичная колода обновлена' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Требуются права администратора' } }
      },
      delete: {
        tags: ['Admin'],
        summary: 'Удаление публичной колоды из библиотеки',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 10 } }],
        responses: { 200: { description: 'Колода удалена из библиотеки' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Требуются права администратора' } }
      }
    },
    '/api/admin/public-decks/{id}/image': {
      post: {
        tags: ['Admin'],
        summary: 'Загрузка изображения для публичной колоды',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 10 } }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  image: { type: 'string', format: 'binary' }
                },
                required: ['image']
              }
            }
          }
        },
        responses: { 200: { description: 'Изображение загружено' }, 400: { description: 'Изображение не загружено' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Требуются права администратора' } }
      }
    },
    '/api/admin/public-decks/{id}/cards': {
      get: {
        tags: ['Admin'],
        summary: 'Получение карточек публичной колоды',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 10 } }],
        responses: { 200: { description: 'Список карточек' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Требуются права администратора' } }
      },
      post: {
        tags: ['Admin'],
        summary: 'Добавление карточки в публичную колоду',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 10 } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CardCreateRequest' } } } },
        responses: { 200: { description: 'Карточка добавлена' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Требуются права администратора' } }
      }
    },
    '/api/admin/public-cards/{id}': {
      delete: {
        tags: ['Admin'],
        summary: 'Удаление публичной карточки',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 123 } }],
        responses: { 200: { description: 'Карточка удалена' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Требуются права администратора' } }
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
    '/chat-api/threads': {
      get: {
        tags: ['Chat'],
        summary: 'Получение списка диалогов',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Список диалогов' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/chat-api/messages/{participantId}': {
      get: {
        tags: ['Chat'],
        summary: 'Получение сообщений с участником',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'participantId', in: 'path', required: true, schema: { type: 'string', example: '2' } }],
        responses: { 200: { description: 'История сообщений' }, 401: { description: 'Требуется авторизация' } }
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
    '/chat-api/messages/group/{groupId}': {
      get: {
        tags: ['Chat'],
        summary: 'Получение сообщений группы',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'groupId', in: 'path', required: true, schema: { type: 'integer', example: 1 } }],
        responses: { 200: { description: 'Сообщения группы' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Нет доступа к группе' } }
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
        summary: 'Создание новой группы',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateGroupRequest' } } } },
        responses: { 201: { description: 'Группа создана' }, 400: { description: 'Неверное название группы' }, 401: { description: 'Требуется авторизация' } }
      }
    },
    '/chat-api/groups/{groupId}': {
      put: {
        tags: ['Chat groups'],
        summary: 'Переименование группы',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'groupId', in: 'path', required: true, schema: { type: 'integer', example: 1 } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GroupUpdateRequest' } } } },
        responses: { 200: { description: 'Группа обновлена' }, 400: { description: 'Неверные данные' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Нет доступа к группе' } }
      }
    },
    '/chat-api/groups/{groupId}/members/me': {
      delete: {
        tags: ['Chat groups'],
        summary: 'Покинуть группу',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'groupId', in: 'path', required: true, schema: { type: 'integer', example: 1 } }],
        responses: { 200: { description: 'Вы вышли из группы' }, 400: { description: 'Неверная группа' }, 401: { description: 'Требуется авторизация' }, 404: { description: 'Вы не состоите в группе' } }
      }
    },
    '/chat-api/groups/{groupId}/participants': {
      post: {
        tags: ['Chat groups'],
        summary: 'Добавление участника в группу',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'groupId', in: 'path', required: true, schema: { type: 'integer', example: 1 } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatUserRequest' } } } },
        responses: { 200: { description: 'Участник добавлен' }, 400: { description: 'Неверные параметры или пользователь уже в группе' }, 401: { description: 'Требуется авторизация' }, 403: { description: 'Нет доступа к группе' } }
      }
    },
    '/chat-api/threads/{participantId}/read': {
      post: {
        tags: ['Chat'],
        summary: 'Отметить сообщения диалога как прочитанные',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'participantId', in: 'path', required: true, schema: { type: 'integer', example: 2 } }],
        responses: { 200: { description: 'Сообщения отмечены как прочитанные' }, 401: { description: 'Требуется авторизация' } }
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
        responses: { 200: { description: 'Сообщение обновлено' }, 400: { description: 'Неверное сообщение или текст' }, 401: { description: 'Требуется авторизация' }, 404: { description: 'Сообщение не найдено' } }
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
