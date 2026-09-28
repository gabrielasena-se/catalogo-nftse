-- Bolão de palpites de placar (jogo de futebol).
-- Idempotente: IF NOT EXISTS não mexe no que já existe.
-- Datas são guardadas em UTC (DATETIME); a conversão para o fuso fica em utils/date.js.
CREATE TABLE IF NOT EXISTS bolao (
  id           INT UNSIGNED     NOT NULL AUTO_INCREMENT PRIMARY KEY,
  channel_id   VARCHAR(32)      NOT NULL,                 -- canal onde vive a mensagem do bolão
  message_id   VARCHAR(32)      NULL,                     -- mensagem única que se atualiza a cada palpite
  title        VARCHAR(255)     NOT NULL,                 -- ex.: "Brasil x Japão ⚽"
  match_at     DATETIME         NOT NULL,                 -- data/hora do jogo (UTC)
  deadline_at  DATETIME         NOT NULL,                 -- limite para palpitar (UTC); padrão = match_at
  max_repeats  TINYINT UNSIGNED NOT NULL DEFAULT 3,       -- quantas pessoas podem repetir o MESMO placar
  prize        VARCHAR(255)     NOT NULL DEFAULT '1 HC',  -- prêmio por acertador (texto livre)
  status       VARCHAR(16)      NOT NULL DEFAULT 'open',  -- open | closed
  created_by   VARCHAR(32)      NOT NULL,                 -- admin que criou
  created_at   TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Palpites. 1 palpite por usuário por bolão (uq_bolao_user).
-- change_count: nº de ALTERAÇÕES já feitas (o 1º palpite não conta). Limite reforçado na aplicação.
CREATE TABLE IF NOT EXISTS bolao_bets (
  id           INT UNSIGNED     NOT NULL AUTO_INCREMENT PRIMARY KEY,
  bolao_id     INT UNSIGNED     NOT NULL,
  user_id      VARCHAR(32)      NOT NULL,                 -- ID do Discord (vínculo real)
  nickname     VARCHAR(255)     NOT NULL,                 -- apelido (o que aparece na lista)
  home_score   TINYINT UNSIGNED NOT NULL,                 -- gols do mandante
  away_score   TINYINT UNSIGNED NOT NULL,                 -- gols do visitante
  change_count TINYINT UNSIGNED NOT NULL DEFAULT 0,       -- alterações usadas (máx. 2)
  created_at   TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_bolao_user (bolao_id, user_id),
  INDEX idx_bolao_score (bolao_id, home_score, away_score),
  CONSTRAINT fk_bet_bolao FOREIGN KEY (bolao_id) REFERENCES bolao (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
