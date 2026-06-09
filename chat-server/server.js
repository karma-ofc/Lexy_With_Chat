require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();

const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || 'lexy-secret-key-2024';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || JWT_SECRET).digest();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'chat',
  password: process.env.DB_PASSWORD || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  ssl: false
});

const server = http.createServer(app);
const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));

app.use((error, req, res, next) => {
  if (error && error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Неверный формат JSON' });
  }
  return next(error);
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  jwt.verify(token, JWT_SECRET, (error, user) => {
    if (error) {
      return res.status(403).json({ error: 'Неверный токен' });
    }

    req.user = user;
    next();
  });
}

function encryptPayload(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedPayload: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  };
}

function decryptPayload(row) {
  if (!row) return null;

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      ENCRYPTION_KEY,
      Buffer.from(row.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(row.encrypted_payload, 'base64')),
      decipher.final()
    ]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch (error) {
    return null;
  }
}

function buildMessageRow(row) {
  const payload = decryptPayload(row) || {};
  let replyTo = payload.reply_to || null;

  // Fallback for older payloads: rebuild reply preview from linked message row.
  if (!replyTo && row.reply_to_message_id) {
    const replyPayload = decryptPayload({
      encrypted_payload: row.reply_encrypted_payload,
      iv: row.reply_iv,
      auth_tag: row.reply_auth_tag
    }) || {};

    replyTo = {
      id: row.reply_to_message_id,
      message_type: row.reply_message_type || 'text',
      text: typeof replyPayload.text === 'string' ? replyPayload.text : '',
      deck: replyPayload.deck || null,
      photo: replyPayload.photo || null,
      sender_name: row.reply_sender_name || '',
      sender_username: row.reply_sender_username || ''
    };
  }

  return {
    id: row.id,
    sender_id: row.sender_id,
    recipient_id: row.recipient_id,
    group_id: row.group_id,
    message_type: row.message_type,
    created_at: row.created_at,
    read_at: row.read_at,
    text: typeof payload.text === 'string' ? payload.text : '',
    sender: row.sender_name
      ? {
          id: row.sender_id,
          name: row.sender_name,
          username: row.sender_username,
          avatar: row.sender_avatar
        }
      : null,
    deck: payload.deck || null,
    photo: payload.photo || null,
    reply_to: replyTo
  };
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL DEFAULT 'User',
      username VARCHAR(50) UNIQUE NOT NULL DEFAULT 'user',
      avatar VARCHAR(10) DEFAULT '👤',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      recipient_id INTEGER NULL REFERENCES users(id),
      group_id INTEGER NULL REFERENCES chat_groups(id),
      message_type VARCHAR(20) NOT NULL DEFAULT 'text',
      encrypted_payload TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      reply_to_message_id INTEGER NULL REFERENCES chat_messages(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      read_at TIMESTAMP NULL,
      CONSTRAINT valid_message_target CHECK (
        (recipient_id IS NOT NULL AND group_id IS NULL) OR
        (recipient_id IS NULL AND group_id IS NOT NULL)
      )
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_groups (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_group_members (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(group_id, user_id)
    )
  `);

  // Add foreign key constraint to chat_groups.creator_id if it doesn't exist
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_chat_groups_creator_id') THEN
        ALTER TABLE chat_groups ADD CONSTRAINT fk_chat_groups_creator_id FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;
      END IF;
    END$$;
  `);

  // Add foreign key constraint to chat_group_members.user_id if it doesn't exist
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_chat_group_members_user_id') THEN
        ALTER TABLE chat_group_members ADD CONSTRAINT fk_chat_group_members_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      END IF;
    END$$;
  `);

  await pool.query("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_message_id INTEGER NULL REFERENCES chat_messages(id)");
  await pool.query("ALTER TABLE chat_messages ALTER COLUMN recipient_id DROP NOT NULL");
  await pool.query("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS group_id INTEGER NULL REFERENCES chat_groups(id)");

  // Add CHECK constraint only if it does not exist (pg_constraint lookup)
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_message_target') THEN
        ALTER TABLE chat_messages ADD CONSTRAINT valid_message_target CHECK (
          (recipient_id IS NOT NULL AND group_id IS NULL) OR
          (recipient_id IS NULL AND group_id IS NOT NULL)
        );
      END IF;
    END$$;
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient_read ON chat_messages (recipient_id, read_at)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages (sender_id, recipient_id, created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_messages_group ON chat_messages (group_id, created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_group_members_group_user ON chat_group_members (group_id, user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_group_members_user ON chat_group_members (user_id)');

  // Ensure encryption columns exist for new message format
  await pool.query("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS encrypted_payload TEXT");
  await pool.query("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS iv TEXT");
  await pool.query("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS auth_tag TEXT");

  // Migrate participants to chat_group_members if not already done
  const migrationCheck = await pool.query('SELECT COUNT(*) FROM chat_group_members');
  if (parseInt(migrationCheck.rows[0].count) === 0) {
    const groups = await pool.query('SELECT id, participants FROM chat_groups WHERE participants IS NOT NULL');
    for (const group of groups.rows) {
      for (const userId of group.participants) {
        await pool.query('INSERT INTO chat_group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [group.id, userId]);
      }
    }
  }

  // Drop participants column if exists
  try {
    await pool.query('ALTER TABLE chat_groups DROP COLUMN IF EXISTS participants');
  } catch (error) {
    // Column may not exist or already dropped
  }
}

app.get('/chat-api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/chat-api/users', authenticateToken, async (req, res) => {
  try {
    const response = await fetch('http://localhost:3000/api/chat/users', {
      headers: { Authorization: req.headers.authorization }
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Chat users proxy error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/chat-api/threads', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS participant_id,
        MAX(created_at) AS last_message_at,
        COUNT(*) FILTER (WHERE recipient_id = $1 AND read_at IS NULL) AS unread_count,
        (ARRAY_AGG(id ORDER BY created_at DESC))[1] AS last_message_id,
        (ARRAY_AGG(sender_id ORDER BY created_at DESC))[1] AS last_sender_id,
        (ARRAY_AGG(recipient_id ORDER BY created_at DESC))[1] AS last_recipient_id,
        (ARRAY_AGG(message_type ORDER BY created_at DESC))[1] AS last_message_type,
        (ARRAY_AGG(encrypted_payload ORDER BY created_at DESC))[1] AS last_encrypted_payload,
        (ARRAY_AGG(iv ORDER BY created_at DESC))[1] AS last_iv,
        (ARRAY_AGG(auth_tag ORDER BY created_at DESC))[1] AS last_auth_tag
      FROM chat_messages
      WHERE sender_id = $1 OR recipient_id = $1
      GROUP BY CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END
      ORDER BY last_message_at DESC`,
      [req.user.id]
    );

    const threads = result.rows.map((row) => {
      const preview = decryptPayload({
        encrypted_payload: row.last_encrypted_payload,
        iv: row.last_iv,
        auth_tag: row.last_auth_tag
      }) || {};

      return {
        participant_id: row.participant_id,
        last_message_at: row.last_message_at,
        unread_count: Number(row.unread_count || 0),
        last_message: {
          id: row.last_message_id,
          sender_id: row.last_sender_id,
          recipient_id: row.last_recipient_id,
          message_type: row.last_message_type,
          text: preview.text || '',
          deck: preview.deck || null
        }
      };
    });

    res.json({ threads });
  } catch (error) {
    console.error('Chat threads error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/chat-api/messages/:participantId', authenticateToken, async (req, res) => {
  try {
    const participantId = Number(req.params.participantId);
    if (!Number.isInteger(participantId)) {
      return res.status(400).json({ error: 'Неверный пользователь' });
    }

    await pool.query(
      'UPDATE chat_messages SET read_at = NOW() WHERE sender_id = $1 AND recipient_id = $2 AND read_at IS NULL',
      [participantId, req.user.id]
    );

    const result = await pool.query(
      `SELECT
          m.*,
          u.name AS sender_name,
          u.username AS sender_username,
          u.avatar AS sender_avatar,
          rm.message_type AS reply_message_type,
          rm.encrypted_payload AS reply_encrypted_payload,
          rm.iv AS reply_iv,
          rm.auth_tag AS reply_auth_tag,
          ru.name AS reply_sender_name,
          ru.username AS reply_sender_username
        FROM chat_messages m
        LEFT JOIN users u ON m.sender_id = u.id
        LEFT JOIN chat_messages rm ON rm.id = m.reply_to_message_id
        LEFT JOIN users ru ON rm.sender_id = ru.id
        WHERE (m.sender_id = $1 AND m.recipient_id = $2)
           OR (m.sender_id = $2 AND m.recipient_id = $1)
        ORDER BY m.created_at ASC`,
      [req.user.id, participantId]
    );

    res.json({ messages: result.rows.map(buildMessageRow) });
  } catch (error) {
    console.error('Chat messages error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/chat-api/messages/group/:groupId', authenticateToken, async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    if (!Number.isInteger(groupId)) {
      return res.status(400).json({ error: 'Неверная группа' });
    }

    // Check if user is in group
    const groupResult = await pool.query(
      'SELECT g.* FROM chat_groups g JOIN chat_group_members gm ON g.id = gm.group_id WHERE g.id = $1 AND gm.user_id = $2',
      [groupId, req.user.id]
    );

    if (groupResult.rows.length === 0) {
      return res.status(403).json({ error: 'Нет доступа к группе' });
    }

    const result = await pool.query(
      `SELECT
         m.*,
         u.name AS sender_name,
         u.username AS sender_username,
         u.avatar AS sender_avatar,
         rm.message_type AS reply_message_type,
         rm.encrypted_payload AS reply_encrypted_payload,
         rm.iv AS reply_iv,
         rm.auth_tag AS reply_auth_tag,
         ru.name AS reply_sender_name,
         ru.username AS reply_sender_username
       FROM chat_messages m
       LEFT JOIN users u ON m.sender_id = u.id
       LEFT JOIN chat_messages rm ON rm.id = m.reply_to_message_id
       LEFT JOIN users ru ON rm.sender_id = ru.id
       WHERE m.group_id = $1
       ORDER BY m.created_at ASC`,
      [groupId]
    );

    res.json({ messages: result.rows.map(buildMessageRow) });
  } catch (error) {
    console.error('Group messages error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/chat-api/messages', authenticateToken, async (req, res) => {
  try {
    const recipientId = req.body.recipientId ? Number(req.body.recipientId) : null;
    const groupId = req.body.groupId ? Number(req.body.groupId) : null;
    const type = req.body.type === 'deck' ? 'deck' : (req.body.type === 'photo' ? 'photo' : 'text');
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    const deck = req.body.deck && typeof req.body.deck === 'object' ? req.body.deck : null;
    const photo = req.body.photo && typeof req.body.photo === 'object' ? req.body.photo : null;
    const replyTo = req.body.reply_to && typeof req.body.reply_to === 'object' ? req.body.reply_to : null;

    if ((!recipientId && !groupId) || (recipientId && groupId)) {
      return res.status(400).json({ error: 'Неверный получатель или группа' });
    }

    if (recipientId && !Number.isInteger(recipientId)) {
      return res.status(400).json({ error: 'Неверный получатель' });
    }

    if (groupId && !Number.isInteger(groupId)) {
      return res.status(400).json({ error: 'Неверная группа' });
    }

    let groupResult = null;
    if (groupId) {
      groupResult = await pool.query(
        'SELECT g.* FROM chat_groups g JOIN chat_group_members gm ON g.id = gm.group_id WHERE g.id = $1 AND gm.user_id = $2',
        [groupId, req.user.id]
      );
      if (groupResult.rows.length === 0) {
        return res.status(403).json({ error: 'Нет доступа к группе' });
      }
    }

    if (type === 'text' && !text) {
      return res.status(400).json({ error: 'Пустое сообщение' });
    }

    if (groupId && !Number.isInteger(groupId)) {
      return res.status(400).json({ error: 'Неверная группа' });
    }

    if (type === 'text' && !text) {
      return res.status(400).json({ error: 'Пустое сообщение' });
    }

    if (type === 'deck' && (!deck || !deck.name || !Array.isArray(deck.cards) || !deck.cards.length)) {
      return res.status(400).json({ error: 'Некорректная колода' });
    }

    if (type === 'photo') {
      const photoSize = Number(photo?.size || 0);
      const photoDataUrl = typeof photo?.dataUrl === 'string' ? photo.dataUrl : '';
      if (!photo || !photoDataUrl || !photoDataUrl.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Некорректное фото' });
      }
      if (!photoSize || photoSize > 10 * 1024 * 1024) {
        return res.status(400).json({ error: 'Фото не должно превышать 10 МБ' });
      }
    }

    if (replyTo && !replyTo.id) {
      return res.status(400).json({ error: 'Некорректный ответ' });
    }

    const payload = type === 'deck'
      ? {
          text: deck.name,
          deck: {
            name: deck.name,
            description: deck.description || '',
            cards: deck.cards.map((card) => ({
              front: String(card.front || card.word || '').trim(),
              back: String(card.back || card.translation || '').trim()
            })).filter((card) => card.front && card.back),
            source_deck_id: deck.source_deck_id || null,
            source_user_id: req.user.id
          },
          reply_to: replyTo || null
        }
        : type === 'photo'
          ? {
              text: photo?.name || 'Фото',
              photo: {
                name: photo?.name || 'photo',
                mimeType: photo?.mimeType || 'image/jpeg',
                size: Number(photo?.size || 0),
                dataUrl: photo?.dataUrl || ''
              },
              deck: null,
              reply_to: replyTo || null
            }
      : { text, deck: null, reply_to: replyTo || null };

    const sender = {
      id: req.user.id,
      name: req.user.name || req.user.username || 'User',
      username: req.user.username || '',
      avatar: req.user.avatar || '👤'
    };

    const encrypted = encryptPayload(payload);
    const replyToMessageId = replyTo?.id ? Number(replyTo.id) : null;
    const result = await pool.query(
      `INSERT INTO chat_messages (sender_id, recipient_id, group_id, message_type, encrypted_payload, iv, auth_tag, reply_to_message_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.user.id, recipientId, groupId, type, encrypted.encryptedPayload, encrypted.iv, encrypted.authTag, replyToMessageId]
    );
    const message = buildMessageRow(result.rows[0]);

    if (recipientId) {
      io.to(`user:${recipientId}`).emit('chat:new_message', message);
    } else if (groupId) {
      const participantsResult = await pool.query('SELECT user_id FROM chat_group_members WHERE group_id = $1', [groupId]);
      participantsResult.rows.forEach(row => io.to(`user:${row.user_id}`).emit('chat:new_message', message));
    }

    res.status(201).json({ message });
  } catch (error) {
    console.error('Chat send error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/chat-api/threads/:participantId/read', authenticateToken, async (req, res) => {
  try {
    const participantId = Number(req.params.participantId);
    if (!Number.isInteger(participantId)) {
      return res.status(400).json({ error: 'Неверный пользователь' });
    }

    await pool.query(
      'UPDATE chat_messages SET read_at = NOW() WHERE sender_id = $1 AND recipient_id = $2 AND read_at IS NULL',
      [participantId, req.user.id]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Chat read error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/chat-api/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const messageId = Number(req.params.messageId);
    const newText = typeof req.body.text === 'string' ? req.body.text.trim() : '';

    if (!Number.isInteger(messageId) || !newText) {
      return res.status(400).json({ error: 'Неверное сообщение или текст' });
    }

    // Fetch message to verify ownership
    const msgResult = await pool.query(
      'SELECT * FROM chat_messages WHERE id = $1',
      [messageId]
    );

    if (msgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    const msg = msgResult.rows[0];
    if (Number(msg.sender_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Нет прав редактировать сообщение' });
    }

    const payload = decryptPayload(msg) || {};
    payload.text = newText;

    const encrypted = encryptPayload(payload);
    const result = await pool.query(
      `UPDATE chat_messages
       SET encrypted_payload = $1, iv = $2, auth_tag = $3
       WHERE id = $4
       RETURNING *`,
      [encrypted.encryptedPayload, encrypted.iv, encrypted.authTag, messageId]
    );

    const updated = buildMessageRow(result.rows[0]);
    io.emit('chat:message_updated', updated);

    res.json({ message: updated });
  } catch (error) {
    console.error('Chat update error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/chat-api/groups', authenticateToken, async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 100) {
      return res.status(400).json({ error: 'Неверное название группы' });
    }

    const result = await pool.query(
      'INSERT INTO chat_groups (name, creator_id) VALUES ($1, $2) RETURNING *',
      [name, req.user.id]
    );
    const group = result.rows[0];

    await pool.query(
      'INSERT INTO chat_group_members (group_id, user_id) VALUES ($1, $2)',
      [group.id, req.user.id]
    );

    res.status(201).json({ group });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/chat-api/groups', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT g.* FROM chat_groups g JOIN chat_group_members gm ON g.id = gm.group_id WHERE gm.user_id = $1 ORDER BY g.created_at DESC',
      [req.user.id]
    );

    res.json({ groups: result.rows });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/chat-api/groups/:groupId/participants', authenticateToken, async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const participantId = Number(req.body.participantId);

    if (!Number.isInteger(groupId) || !Number.isInteger(participantId)) {
      return res.status(400).json({ error: 'Неверные параметры' });
    }

    // Check if user is in group
    const groupResult = await pool.query(
      'SELECT g.* FROM chat_groups g JOIN chat_group_members gm ON g.id = gm.group_id WHERE g.id = $1 AND gm.user_id = $2',
      [groupId, req.user.id]
    );

    if (groupResult.rows.length === 0) {
      return res.status(403).json({ error: 'Нет доступа к группе' });
    }

    // Check participant count
    const countResult = await pool.query('SELECT COUNT(*) FROM chat_group_members WHERE group_id = $1', [groupId]);
    if (parseInt(countResult.rows[0].count) >= 10) {
      return res.status(400).json({ error: 'Группа уже имеет максимум участников' });
    }

    // Check if participant already in group
    const existsResult = await pool.query('SELECT 1 FROM chat_group_members WHERE group_id = $1 AND user_id = $2', [groupId, participantId]);
    if (existsResult.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь уже в группе' });
    }

    await pool.query(
      'INSERT INTO chat_group_members (group_id, user_id) VALUES ($1, $2)',
      [groupId, participantId]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});



app.delete('/chat-api/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const messageId = Number(req.params.messageId);
    const deleteFor = req.body.deleteFor || 'self'; // 'self' или 'all'

    if (!Number.isInteger(messageId)) {
      return res.status(400).json({ error: 'Неверное сообщение' });
    }

    // Fetch message to verify ownership
    const msgResult = await pool.query(
      'SELECT * FROM chat_messages WHERE id = $1',
      [messageId]
    );

    if (msgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    const msg = msgResult.rows[0];
    if (Number(msg.sender_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Нет прав удалять сообщение' });
    }

    if (deleteFor === 'all') {
      // Delete for everyone
      await pool.query(
        'DELETE FROM chat_messages WHERE id = $1',
        [messageId]
      );
      io.emit('chat:message_deleted', { messageId });
    } else {
      // Delete for self (client-side only for now - just return success)
      // In a more advanced impl, we'd track deleted_by_sender/recipient
      io.emit('chat:message_deleted_self', { messageId, userId: req.user.id });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Chat delete error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('unauthorized'));
  }

  jwt.verify(token, JWT_SECRET, (error, user) => {
    if (error) {
      return next(new Error('unauthorized'));
    }

    socket.user = user;
    next();
  });
});

io.on('connection', (socket) => {
  if (!socket.user?.id) {
    socket.disconnect(true);
    return;
  }

  socket.join(`user:${socket.user.id}`);
  socket.emit('chat:ready', { userId: socket.user.id });

  socket.on('chat:mark_read', async ({ participantId }) => {
    const otherId = Number(participantId);
    if (!Number.isInteger(otherId)) return;

    try {
      await pool.query(
        'UPDATE chat_messages SET read_at = NOW() WHERE sender_id = $1 AND recipient_id = $2 AND read_at IS NULL',
        [otherId, socket.user.id]
      );

      socket.emit('chat:read_confirmed', { participantId: otherId });
    } catch (error) {
      console.error('chat:mark_read error:', error);
    }
  });
});

async function start() {
  try {
    await initDb();
    server.listen(PORT, () => {
      console.log(`Chat service is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start chat service:', error);
    process.exit(1);
  }
}

start();