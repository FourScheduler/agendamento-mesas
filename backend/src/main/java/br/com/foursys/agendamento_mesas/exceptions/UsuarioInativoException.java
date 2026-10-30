package br.com.foursys.agendamento_mesas.exceptions;

public class UsuarioInativoException extends RuntimeException {

    public UsuarioInativoException() {
        super("Usuário inativo.");
    }
}
