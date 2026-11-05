-- Um usuário só pode manter um vínculo como responsável de mesa.
-- NULL permanece permitido para mesas livres ou fixas sem responsável legado.
-- Se houver duplicidades, a criação da constraint falha sem escolher/remover vínculos.
ALTER TABLE mesas
    ADD CONSTRAINT uk_mesas_responsavel UNIQUE (responsavel_id);
