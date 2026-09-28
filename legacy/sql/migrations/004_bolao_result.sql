-- Resultado final do jogo e controle de anúncio de vencedores.
-- Cada migration roda UMA vez (tabela schema_migrations), então um ALTER simples
-- já é seguro — não precisa de "IF NOT EXISTS" (que nem é suportado em todo MySQL).
ALTER TABLE bolao
  ADD COLUMN result_home          TINYINT UNSIGNED NULL DEFAULT NULL AFTER prize,
  ADD COLUMN result_away          TINYINT UNSIGNED NULL DEFAULT NULL AFTER result_home,
  ADD COLUMN winners_announced_at TIMESTAMP        NULL DEFAULT NULL AFTER result_away;
