package br.com.foursys.agendamento_mesas.exceptions;

/**
 * Erro para tentativa de criar usuário com e-mail já cadastrado (responde 409).
 */
public class EmailJaCadastradoException extends RuntimeException {

    public EmailJaCadastradoException() {
        super("E-mail já cadastrado.");
    }
}
