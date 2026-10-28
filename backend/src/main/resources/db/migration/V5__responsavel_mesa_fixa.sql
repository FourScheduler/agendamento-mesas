-- V2 a V4 são seeds de desenvolvimento; V5 evita conflito no histórico Flyway.
-- Mesas FIXA legadas continuam sem responsável até atribuição explícita.
ALTER TABLE mesas ADD COLUMN responsavel_id BIGINT NULL;
ALTER TABLE mesas ADD CONSTRAINT uk_mesas_responsavel UNIQUE (responsavel_id);
ALTER TABLE mesas ADD CONSTRAINT fk_mesas_responsavel
    FOREIGN KEY (responsavel_id) REFERENCES usuarios (id);
ALTER TABLE mesas ADD CONSTRAINT ck_mesas_responsavel_ativo_fixa
    CHECK (responsavel_id IS NULL OR (tipo = 'FIXA' AND ativa = TRUE));
