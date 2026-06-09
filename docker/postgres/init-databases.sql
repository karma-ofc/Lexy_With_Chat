SELECT 'CREATE DATABASE lexy'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'lexy'
)\gexec

SELECT 'CREATE DATABASE chat'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'chat'
)\gexec