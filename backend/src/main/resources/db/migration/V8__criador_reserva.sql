ALTER TABLE reservas ADD COLUMN criado_por_id BIGINT NULL;

ALTER TABLE reservas
    ADD CONSTRAINT fk_reservas_criador
    FOREIGN KEY (criado_por_id) REFERENCES usuarios (id);
