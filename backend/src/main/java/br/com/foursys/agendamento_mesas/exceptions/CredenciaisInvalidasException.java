package br.com.foursys.agendamento_mesas.exceptions;

public class CredenciaisInvalidasException extends RuntimeException {

    public CredenciaisInvalidasException() {
        super("Credenciais inválidas.");
    }
}
