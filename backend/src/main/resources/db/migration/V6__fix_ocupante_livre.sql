-- Corrige ocupante='Livre' para NULL (mesas sem ocupante definido)
-- As mesas com tipo LIVRE já indicam disponibilidade visual via cor/status

UPDATE mesas SET ocupante = NULL WHERE ocupante = 'Livre';