-- Mantem codigo, ID e posicao do seed original. Somente dev/demonstracao.
-- Mesa inativa continua no catalogo; inatividade nao significa ocupacao temporal.
UPDATE mesas SET ativa = FALSE WHERE codigo = '005';
