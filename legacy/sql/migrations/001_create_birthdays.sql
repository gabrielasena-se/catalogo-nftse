-- Aniversários (já em produção). Idempotente: IF NOT EXISTS não mexe no que existe.
-- Guardamos apenas dia e mês (o usuário informa só DD/MM, sem ano).
CREATE TABLE IF NOT EXISTS birthdays (
  user_id     VARCHAR(32)  NOT NULL PRIMARY KEY,  -- ID do Discord
  nickname    VARCHAR(255) NOT NULL,              -- apelido no servidor
  birth_day   TINYINT      NOT NULL,              -- 1..31
  birth_month TINYINT      NOT NULL,              -- 1..12
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_month_day (birth_month, birth_day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
