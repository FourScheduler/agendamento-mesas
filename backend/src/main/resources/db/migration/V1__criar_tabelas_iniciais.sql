-- Estrutura da tabela de usuários.
-- Senhas são persistidas apenas como hash (BCrypt); texto puro nunca é gravado.
CREATE TABLE usuarios (
    id BIGINT NOT NULL AUTO_INCREMENT,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL,
    senha_hash VARCHAR(100) NOT NULL,
    perfil VARCHAR(20) NOT NULL,
    ativo BOOLEAN NOT NULL,
    criado_em DATETIME NOT NULL,
    atualizado_em DATETIME NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_usuarios_email UNIQUE (email)
);

-- Estrutura da tabela de mesas.
-- planta/posicao_x/posicao_y são apenas referência visual para a planta no frontend.
CREATE TABLE mesas (
    id BIGINT NOT NULL AUTO_INCREMENT,
    codigo VARCHAR(10) NOT NULL,
    regiao VARCHAR(40) NOT NULL,
    tipo VARCHAR(10) NOT NULL,
    ativa BOOLEAN NOT NULL,
    planta VARCHAR(20) NOT NULL,
    posicao_x INTEGER NOT NULL,
    posicao_y INTEGER NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_mesas_codigo UNIQUE (codigo)
);

-- Estrutura da tabela de reservas.
-- usuario_id e mesa_id são obrigatórios (FK) para manter o vínculo histórico do solicitante,
-- inclusive após o cancelamento.
CREATE TABLE reservas (
    id BIGINT NOT NULL AUTO_INCREMENT,
    mesa_id BIGINT NOT NULL,
    usuario_id BIGINT NOT NULL,
    data DATE NOT NULL,
    status VARCHAR(10) NOT NULL,
    criada_em DATETIME NOT NULL,
    confirmada_em DATETIME NULL,
    cancelada_em DATETIME NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_reservas_mesa FOREIGN KEY (mesa_id) REFERENCES mesas (id),
    CONSTRAINT fk_reservas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
);

-- Índices para disponibilidade (mesa/data/status) e consultas por usuário.
CREATE INDEX idx_reservas_mesadata ON reservas (mesa_id, data, status);
CREATE INDEX idx_reservas_usuariodata ON reservas (usuario_id, data, status);
