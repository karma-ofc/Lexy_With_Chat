const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

const projectRoot = path.join(__dirname, '..');

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return {};
    }
    return dotenv.parse(fs.readFileSync(filePath));
}

function buildDbConfig(fileEnv, fallbackDatabase) {
    return {
        host: process.env.DB_HOST || process.env.PGHOST || fileEnv.DB_HOST || fileEnv.PGHOST || 'localhost',
        port: Number(process.env.DB_PORT || process.env.PGPORT || fileEnv.DB_PORT || fileEnv.PGPORT || 5432),
        user: process.env.DB_USER || process.env.PGUSER || fileEnv.DB_USER || fileEnv.PGUSER || 'postgres',
        password: process.env.DB_PASSWORD || process.env.PGPASSWORD || fileEnv.DB_PASSWORD || fileEnv.PGPASSWORD || 'postgres',
        database: process.env.DB_NAME || process.env.PGDATABASE || fileEnv.DB_NAME || fileEnv.PGDATABASE || fallbackDatabase,
    };
}

function quoteIdent(identifier) {
    return '"' + String(identifier).replace(/"/g, '""') + '"';
}

function normalizeValue(value) {
    if (Buffer.isBuffer(value)) {
        return value.toString('base64');
    }
    return value;
}

async function hasColumn(client, tableName, columnName) {
    const result = await client.query(`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = $1
              AND column_name = $2
        ) AS exists
    `, [tableName, columnName]);
    return Boolean(result.rows[0]?.exists);
}

async function ensureChatSchema(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS roles (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) UNIQUE NOT NULL
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
            name VARCHAR(100) NOT NULL,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            avatar VARCHAR(10) DEFAULT '👤',
            notifications_enabled BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS learned_words INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS study_time INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS accuracy INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_study_date DATE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_reason TEXT`);

    await client.query(`
        CREATE TABLE IF NOT EXISTS chat_groups (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await client.query(`ALTER TABLE chat_groups ADD COLUMN IF NOT EXISTS max_members INTEGER`);

    await client.query(`
        CREATE TABLE IF NOT EXISTS chat_group_members (
            group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (group_id, user_id)
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
            id SERIAL PRIMARY KEY,
            sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            group_id INTEGER REFERENCES chat_groups(id) ON DELETE CASCADE,
            message_type VARCHAR(20) DEFAULT 'text',
            text TEXT,
            photo JSONB,
            deck JSONB,
            reply_to_message_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,
            read_at TIMESTAMP,
            deleted_for_sender BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS text TEXT`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS photo JSONB`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deck JSONB`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_for_sender BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sender_name VARCHAR(100)`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sender_username VARCHAR(50)`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sender_avatar VARCHAR(10)`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_message_id INTEGER`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS encrypted_payload TEXT`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS iv TEXT`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS auth_tag TEXT`);
    await client.query(`ALTER TABLE chat_messages ALTER COLUMN encrypted_payload DROP NOT NULL`);
    await client.query(`ALTER TABLE chat_messages ALTER COLUMN iv DROP NOT NULL`);
    await client.query(`ALTER TABLE chat_messages ALTER COLUMN auth_tag DROP NOT NULL`);

    // Remove denormalized columns for 3NF compliance
    await client.query(`ALTER TABLE chat_messages DROP COLUMN IF EXISTS sender_name`);
    await client.query(`ALTER TABLE chat_messages DROP COLUMN IF EXISTS sender_username`);
    await client.query(`ALTER TABLE chat_messages DROP COLUMN IF EXISTS sender_avatar`);

    if (await hasColumn(client, 'chat_groups', 'participants')) {
        await client.query(`
            INSERT INTO chat_group_members (group_id, user_id)
            SELECT g.id, p.user_id
            FROM chat_groups g,
            LATERAL unnest(COALESCE(g.participants, '{}'::INTEGER[])) AS p(user_id)
            ON CONFLICT DO NOTHING
        `);
        await client.query(`ALTER TABLE chat_groups DROP COLUMN participants`);
    }

    if (await hasColumn(client, 'chat_messages', 'reply_to')) {
        await client.query(`
            UPDATE chat_messages
            SET reply_to_message_id = NULLIF((reply_to->>'id')::INTEGER, 0)
            WHERE reply_to_message_id IS NULL
              AND reply_to IS NOT NULL
              AND (reply_to->>'id') ~ '^[0-9]+$'
        `);
        await client.query(`ALTER TABLE chat_messages DROP COLUMN reply_to`);
    }

    await client.query(`TRUNCATE TABLE chat_messages, chat_group_members, chat_groups, users, roles RESTART IDENTITY CASCADE`);
}

/**
 * Ensure chat schema exists without clearing existing data
 * Used by auto-migration before data insertion
 */
async function ensureChatSchemaStructure(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS roles (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) UNIQUE NOT NULL
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
            name VARCHAR(100) NOT NULL,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            avatar VARCHAR(10) DEFAULT '👤',
            notifications_enabled BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS learned_words INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS study_time INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS accuracy INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_study_date DATE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_reason TEXT`);

    await client.query(`
        CREATE TABLE IF NOT EXISTS chat_groups (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await client.query(`ALTER TABLE chat_groups ADD COLUMN IF NOT EXISTS max_members INTEGER`);

    await client.query(`
        CREATE TABLE IF NOT EXISTS chat_group_members (
            group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (group_id, user_id)
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
            id SERIAL PRIMARY KEY,
            sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            group_id INTEGER REFERENCES chat_groups(id) ON DELETE CASCADE,
            message_type VARCHAR(20) DEFAULT 'text',
            text TEXT,
            photo JSONB,
            deck JSONB,
            reply_to_message_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,
            read_at TIMESTAMP,
            deleted_for_sender BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS text TEXT`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS photo JSONB`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deck JSONB`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_for_sender BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_message_id INTEGER`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS encrypted_payload TEXT`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS iv TEXT`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS auth_tag TEXT`);
    await client.query(`ALTER TABLE chat_messages ALTER COLUMN encrypted_payload DROP NOT NULL`);
    await client.query(`ALTER TABLE chat_messages ALTER COLUMN iv DROP NOT NULL`);
    await client.query(`ALTER TABLE chat_messages ALTER COLUMN auth_tag DROP NOT NULL`);

    await client.query(`ALTER TABLE chat_messages DROP COLUMN IF EXISTS sender_name`);
    await client.query(`ALTER TABLE chat_messages DROP COLUMN IF EXISTS sender_username`);
    await client.query(`ALTER TABLE chat_messages DROP COLUMN IF EXISTS sender_avatar`);

    if (await hasColumn(client, 'chat_groups', 'participants')) {
        await client.query(`
            INSERT INTO chat_group_members (group_id, user_id)
            SELECT g.id, p.user_id
            FROM chat_groups g,
            LATERAL unnest(COALESCE(g.participants, '{}'::INTEGER[])) AS p(user_id)
            ON CONFLICT DO NOTHING
        `);
        await client.query(`ALTER TABLE chat_groups DROP COLUMN participants`);
    }

    if (await hasColumn(client, 'chat_messages', 'reply_to')) {
        await client.query(`
            UPDATE chat_messages
            SET reply_to_message_id = NULLIF((reply_to->>'id')::INTEGER, 0)
            WHERE reply_to_message_id IS NULL
              AND reply_to IS NOT NULL
              AND (reply_to->>'id') ~ '^[0-9]+$'
        `);
        await client.query(`ALTER TABLE chat_messages DROP COLUMN reply_to`);
    }
}

async function dumpTable(client, tableName) {
    const result = await client.query(`SELECT * FROM ${quoteIdent(tableName)} ORDER BY id ASC`);
    return result.rows.map((row) => {
        const normalizedRow = {};
        for (const [key, value] of Object.entries(row)) {
            normalizedRow[key] = normalizeValue(value);
        }
        return normalizedRow;
    });
}

async function writeBackup(client, label, tables, backupDir) {
    const backup = {
        label,
        createdAt: new Date().toISOString(),
        tables: {},
    };

    for (const tableName of tables) {
        try {
            backup.tables[tableName] = await dumpTable(client, tableName);
        } catch (error) {
            backup.tables[tableName] = [];
        }
    }

    const backupPath = path.join(backupDir, `${label}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');
    return backupPath;
}

async function insertRows(client, tableName, rows) {
    if (!rows.length) {
        return;
    }

    // Get existing columns in target table
    const columnResult = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position
    `, [tableName]);

    const existingColumns = new Set(columnResult.rows.map(row => row.column_name));

    const sourceColumns = Object.keys(rows[0]);
    const columns = sourceColumns.filter(col => existingColumns.has(col));

    if (!columns.length) {
        console.log(`[Migration] No matching columns for table ${tableName}, skipping insert`);
        return;
    }

    const columnSql = columns.map(quoteIdent).join(', ');
    const valuesSql = rows.map((row, rowIndex) => {
        const placeholders = columns.map((_, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`);
        return `(${placeholders.join(', ')})`;
    }).join(', ');

    const values = [];
    for (const row of rows) {
        for (const column of columns) {
            values.push(row[column]);
        }
    }

    await client.query(
        `INSERT INTO ${quoteIdent(tableName)} (${columnSql}) VALUES ${valuesSql}`,
        values,
    );
}

async function resetSequence(client, tableName, columnName) {
    await client.query(
        `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT MAX(${quoteIdent(columnName)}) FROM ${quoteIdent(tableName)}), 1), true)`,
        [tableName, columnName],
    );
}

async function syncChatUsers() {
    const sourceEnvPath = path.join(projectRoot, 'server', '.env');
    const targetEnvPath = path.join(projectRoot, 'chat-server', '.env');

    const sourceEnv = loadEnvFile(sourceEnvPath);
    const targetEnv = loadEnvFile(targetEnvPath);
    const sourceConfig = buildDbConfig(sourceEnv, 'lexy');
    const targetConfig = buildDbConfig(targetEnv, 'chat');

    const sourceClient = new Client(sourceConfig);
    const targetClient = new Client(targetConfig);

    try {
        await sourceClient.connect();
        await targetClient.connect();

        const rolesResult = await sourceClient.query('SELECT id, name FROM roles ORDER BY id');
        for (const role of rolesResult.rows) {
            await targetClient.query(
                `INSERT INTO roles (id, name)
                 VALUES ($1, $2)
                 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
                [role.id, role.name]
            );
        }

        const usersResult = await sourceClient.query(`
            SELECT
                u.id,
                u.role_id,
                u.name,
                u.username,
                u.password,
                COALESCE(u.avatar, '👤') AS avatar,
                COALESCE(u.notifications_enabled, TRUE) AS notifications_enabled,
                u.created_at
            FROM users u
            ORDER BY u.id
        `);

        for (const user of usersResult.rows) {
            await targetClient.query(
                `INSERT INTO users (id, role_id, name, username, password, avatar, notifications_enabled, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO UPDATE SET
                     role_id = EXCLUDED.role_id,
                     name = EXCLUDED.name,
                     username = EXCLUDED.username,
                     password = EXCLUDED.password,
                     avatar = EXCLUDED.avatar,
                     notifications_enabled = EXCLUDED.notifications_enabled,
                     created_at = COALESCE(users.created_at, EXCLUDED.created_at)`,
                [
                    user.id,
                    user.role_id,
                    user.name,
                    user.username,
                    user.password,
                    user.avatar,
                    user.notifications_enabled,
                    user.created_at,
                ]
            );
        }

        await resetSequence(targetClient, 'roles', 'id');
        await resetSequence(targetClient, 'users', 'id');

        return { rolesSynced: rolesResult.rows.length, usersSynced: usersResult.rows.length };
    } finally {
        await sourceClient.end();
        await targetClient.end();
    }
}

async function verifyIntegrity(client) {
    const usersResult = await client.query('SELECT id FROM users');
    const userIds = new Set(usersResult.rows.map((row) => Number(row.id)));

    const groupsResult = await client.query('SELECT id, creator_id FROM chat_groups');
    const groupMembersResult = await client.query('SELECT group_id, user_id FROM chat_group_members');
    const messagesResult = await client.query('SELECT id, sender_id, recipient_id, group_id FROM chat_messages');

    const problems = [];

    for (const group of groupsResult.rows) {
        if (group.creator_id !== null && !userIds.has(Number(group.creator_id))) {
            problems.push(`chat_groups.id=${group.id} has missing creator_id=${group.creator_id}`);
        }
    }

    for (const member of groupMembersResult.rows) {
        if (!groupsResult.rows.some((group) => Number(group.id) === Number(member.group_id))) {
            problems.push(`chat_group_members has missing group_id=${member.group_id}`);
        }
        if (!userIds.has(Number(member.user_id))) {
            problems.push(`chat_group_members has missing user_id=${member.user_id}`);
        }
    }

    for (const message of messagesResult.rows) {
        if (message.sender_id !== null && !userIds.has(Number(message.sender_id))) {
            problems.push(`chat_messages.id=${message.id} has missing sender_id=${message.sender_id}`);
        }

        if (message.recipient_id !== null && !userIds.has(Number(message.recipient_id))) {
            problems.push(`chat_messages.id=${message.id} has missing recipient_id=${message.recipient_id}`);
        }

        if (message.group_id !== null && !groupsResult.rows.some((group) => Number(group.id) === Number(message.group_id))) {
            problems.push(`chat_messages.id=${message.id} has missing group_id=${message.group_id}`);
        }
    }

    return problems;
}

/**
 * Check if migration is needed
 * Returns true if source has users but target doesn't
 */
async function isMigrationNeeded(sourceClient, targetClient) {
    try {
        const sourceResult = await sourceClient.query('SELECT COUNT(*) FROM users');
        const sourceCount = parseInt(sourceResult.rows[0].count, 10);

        const tableExistsResult = await targetClient.query(
            `SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'users'
            ) AS exists`
        );
        const targetUsersTableExists = Boolean(tableExistsResult.rows[0]?.exists);

        if (!targetUsersTableExists) {
            return sourceCount > 0;
        }

        const targetResult = await targetClient.query('SELECT COUNT(*) FROM users');
        const targetCount = parseInt(targetResult.rows[0].count, 10);

        return sourceCount > 0 && targetCount === 0;
    } catch (error) {
        console.error('[Migration] Error checking migration status:', error.message);
        return false;
    }
}

/**
 * Auto-migrate chat data from source to target database
 * Used on server startup
 */
async function autoMigrate() {
    const sourceEnvPath = path.join(projectRoot, 'server', '.env');
    const targetEnvPath = path.join(projectRoot, 'chat-server', '.env');
    const backupRoot = path.join(projectRoot, 'migrations', 'backups');

    const sourceEnv = loadEnvFile(sourceEnvPath);
    const targetEnv = loadEnvFile(targetEnvPath);
    const sourceConfig = buildDbConfig(sourceEnv, 'lexy');
    const targetConfig = buildDbConfig(targetEnv, 'chat');
    const backupDir = path.join(backupRoot, new Date().toISOString().replace(/[:.]/g, '-'));

    const sourceClient = new Client(sourceConfig);
    const targetClient = new Client(targetConfig);

    try {
        await sourceClient.connect();
        await targetClient.connect();

        // Check if migration is needed
        const needsMigration = await isMigrationNeeded(sourceClient, targetClient);
        
        if (!needsMigration) {
            console.log('[Migration] Chat database is already populated or source is empty. Skipping auto-migration.');
            return true;
        }

        console.log('[Migration] Starting automatic chat data migration from lexy to chat database...');

        fs.mkdirSync(backupDir, { recursive: true });

        const tablesToBackup = ['roles', 'users', 'chat_groups', 'chat_group_members', 'chat_messages'];

        console.log('[Migration] Preparing target schema (create if not exists)...');
        await ensureChatSchemaStructure(targetClient);

        console.log('[Migration] Creating backups...');
        const sourceBackup = await writeBackup(sourceClient, 'source-before', tablesToBackup, backupDir);
        const targetBackup = await writeBackup(targetClient, 'target-before', tablesToBackup, backupDir);

        console.log('[Migration] Fetching data from source database...');
        const rolesRows = await sourceClient.query('SELECT * FROM roles ORDER BY id ASC');
        const usersRows = await sourceClient.query('SELECT * FROM users ORDER BY id ASC');
        const groupsRows = await sourceClient.query('SELECT * FROM chat_groups ORDER BY id ASC');
        const sourceHasGroupMembers = await sourceClient.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'chat_group_members'
            ) AS exists
        `);
        let groupMembersRows;
        if (sourceHasGroupMembers.rows[0]?.exists) {
            groupMembersRows = await sourceClient.query('SELECT * FROM chat_group_members ORDER BY group_id ASC, user_id ASC');
        } else {
            groupMembersRows = {
                rows: groupsRows.rows.flatMap((group) => {
                    const participants = Array.isArray(group.participants) ? group.participants : [];
                    return participants.map((userId) => ({
                        group_id: group.id,
                        user_id: userId,
                    }));
                }),
            };
        }
        const messagesRows = await sourceClient.query('SELECT * FROM chat_messages ORDER BY id ASC');

        console.log(`[Migration] Found ${rolesRows.rows.length} roles, ${usersRows.rows.length} users, ${groupsRows.rows.length} groups, ${messagesRows.rows.length} messages`);

        await targetClient.query('BEGIN');

        console.log('[Migration] Ensuring schema structure for data insertion...');
        await ensureChatSchemaStructure(targetClient);

        console.log('[Migration] Inserting data into target database...');
        await insertRows(targetClient, 'roles', rolesRows.rows);
        await insertRows(targetClient, 'users', usersRows.rows);
        await insertRows(targetClient, 'chat_groups', groupsRows.rows);
        await insertRows(targetClient, 'chat_group_members', groupMembersRows.rows);
        await insertRows(targetClient, 'chat_messages', messagesRows.rows);

        console.log('[Migration] Resetting sequences...');
        await resetSequence(targetClient, 'roles', 'id');
        await resetSequence(targetClient, 'users', 'id');
        await resetSequence(targetClient, 'chat_groups', 'id');
        await resetSequence(targetClient, 'chat_messages', 'id');

        console.log('[Migration] Verifying data integrity...');
        const integrityProblems = await verifyIntegrity(targetClient);
        if (integrityProblems.length > 0) {
            throw new Error(`Integrity check failed:\n- ${integrityProblems.join('\n- ')}`);
        }

        await targetClient.query('COMMIT');

        console.log('[Migration] ✓ Chat migration completed successfully!');
        console.log(`[Migration] Source backup: ${sourceBackup}`);
        console.log(`[Migration] Target backup: ${targetBackup}`);
        console.log(`[Migration] Backup directory: ${backupDir}`);
        console.log('[Migration] Copied tables: roles, users, chat_groups, chat_group_members, chat_messages');
        console.log('[Migration] Integrity check: OK');
        
        return true;
    } catch (error) {
        try {
            await targetClient.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('[Migration] Rollback failed:', rollbackError.message);
        }

        console.error('[Migration] ✗ Chat migration failed:', error.message);
        return false;
    } finally {
        await sourceClient.end();
        await targetClient.end();
    }
}

/**
 * Manual migration function (used by migrate_chat_db.js)
 */
async function manualMigrate() {
    const sourceEnvPath = path.join(projectRoot, 'server', '.env');
    const targetEnvPath = path.join(projectRoot, 'chat-server', '.env');
    const backupRoot = path.join(projectRoot, 'migrations', 'backups');

    const sourceEnv = loadEnvFile(sourceEnvPath);
    const targetEnv = loadEnvFile(targetEnvPath);
    const sourceConfig = buildDbConfig(sourceEnv, 'lexy');
    const targetConfig = buildDbConfig(targetEnv, 'chat');
    const backupDir = path.join(backupRoot, new Date().toISOString().replace(/[:.]/g, '-'));

    fs.mkdirSync(backupDir, { recursive: true });

    const sourceClient = new Client(sourceConfig);
    const targetClient = new Client(targetConfig);

    await sourceClient.connect();
    await targetClient.connect();

    const tablesToBackup = ['roles', 'users', 'chat_groups', 'chat_group_members', 'chat_messages'];

    try {
        await ensureChatSchema(targetClient);

        const sourceBackup = await writeBackup(sourceClient, 'source-before', tablesToBackup, backupDir);
        const targetBackup = await writeBackup(targetClient, 'target-before', tablesToBackup, backupDir);

        const rolesRows = await sourceClient.query('SELECT * FROM roles ORDER BY id ASC');
        const usersRows = await sourceClient.query('SELECT * FROM users ORDER BY id ASC');
        const groupsRows = await sourceClient.query('SELECT * FROM chat_groups ORDER BY id ASC');
        const sourceHasGroupMembers = await sourceClient.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'chat_group_members'
            ) AS exists
        `);
        let groupMembersRows;
        if (sourceHasGroupMembers.rows[0]?.exists) {
            groupMembersRows = await sourceClient.query('SELECT * FROM chat_group_members ORDER BY group_id ASC, user_id ASC');
        } else {
            groupMembersRows = {
                rows: groupsRows.rows.flatMap((group) => {
                    const participants = Array.isArray(group.participants) ? group.participants : [];
                    return participants.map((userId) => ({
                        group_id: group.id,
                        user_id: userId,
                    }));
                }),
            };
        }
        const messagesRows = await sourceClient.query('SELECT * FROM chat_messages ORDER BY id ASC');

        await targetClient.query('BEGIN');
        await ensureChatSchema(targetClient);

        await insertRows(targetClient, 'roles', rolesRows.rows);
        await insertRows(targetClient, 'users', usersRows.rows);
        await insertRows(targetClient, 'chat_groups', groupsRows.rows);
        await insertRows(targetClient, 'chat_group_members', groupMembersRows.rows);
        await insertRows(targetClient, 'chat_messages', messagesRows.rows);

        await resetSequence(targetClient, 'roles', 'id');
        await resetSequence(targetClient, 'users', 'id');
        await resetSequence(targetClient, 'chat_groups', 'id');
        await resetSequence(targetClient, 'chat_messages', 'id');

        const integrityProblems = await verifyIntegrity(targetClient);
        if (integrityProblems.length > 0) {
            throw new Error(`Integrity check failed:\n- ${integrityProblems.join('\n- ')}`);
        }

        await targetClient.query('COMMIT');

        console.log('Chat migration completed successfully.');
        console.log(`Source backup: ${sourceBackup}`);
        console.log(`Target backup: ${targetBackup}`);
        console.log(`Backup directory: ${backupDir}`);
        console.log('Copied tables: roles, users, chat_groups, chat_group_members, chat_messages');
        console.log('Integrity check: OK');
    } catch (error) {
        try {
            await targetClient.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('Rollback failed:', rollbackError.message);
        }

        console.error('Chat migration failed:', error.message);
        process.exitCode = 1;
    } finally {
        await sourceClient.end();
        await targetClient.end();
    }
}

module.exports = {
    autoMigrate,
    manualMigrate,
    syncChatUsers,
};
