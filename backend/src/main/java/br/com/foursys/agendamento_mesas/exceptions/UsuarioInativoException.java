package br.com.foursys.agendamento_mesas.exceptions;

/**
 * Erro para login de usuário existente e com senha correta, mas desativado.
 */
public class UsuarioInativoException extends RuntimeException {

    public UsuarioInativoException() {
        super("Usuário inativo.");
    }
}
