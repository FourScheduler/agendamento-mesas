package br.com.foursys.agendamento_mesas.exceptions;

/**
 * Erro para login com e-mail inexistente ou senha incorreta. A resposta é a
 * mesma nos dois casos para não revelar quais e-mails existem.
 */
public class CredenciaisInvalidasException extends RuntimeException {

    public CredenciaisInvalidasException() {
        super("Credenciais inválidas.");
    }
}
