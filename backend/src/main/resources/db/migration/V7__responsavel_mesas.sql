ALTER TABLE mesas ADD COLUMN responsavel_id BIGINT NULL;

ALTER TABLE mesas
    ADD CONSTRAINT fk_mesas_responsavel
    FOREIGN KEY (responsavel_id) REFERENCES usuarios (id);
