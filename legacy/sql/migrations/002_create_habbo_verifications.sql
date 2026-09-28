-- Vínculo conta Habbo <-> usuário Discord.
-- discord_user_id é PK (1 registro por usuário).
-- habbo_unique_id é UNIQUE -> garante 1 conta Habbo = 1 Discord.
CREATE TABLE IF NOT EXISTS habbo_verifications (
  discord_user_id VARCHAR(32)  NOT NULL PRIMARY KEY,
  habbo_name      VARCHAR(255) NOT NULL,
  habbo_unique_id VARCHAR(64)  NOT NULL,
  verified_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_habbo_unique (habbo_unique_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
