ALTER TABLE reservas ADD COLUMN chave_requisicao VARCHAR(36) NULL;
ALTER TABLE reservas ADD CONSTRAINT uk_reservas_autor_chave UNIQUE (criado_por_id, chave_requisicao);
CREATE INDEX idx_reservas_retencao ON reservas (status, cancelada_em, id);
CREATE INDEX idx_reservas_usuario_pagina ON reservas (usuario_id, status, data, id);
CREATE INDEX idx_reservas_status_pagina ON reservas (status, data, id);
