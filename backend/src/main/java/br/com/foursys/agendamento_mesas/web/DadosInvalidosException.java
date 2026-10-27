package br.com.foursys.agendamento_mesas.web;

/**
 * Erro para request com dados ausentes ou inválidos (responde 400).
 */
public class DadosInvalidosException extends RuntimeException {

    public DadosInvalidosException(String mensagem) {
        super(mensagem);
    }
}
