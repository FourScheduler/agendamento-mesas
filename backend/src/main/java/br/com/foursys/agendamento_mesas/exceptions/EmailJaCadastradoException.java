package br.com.foursys.agendamento_mesas.exceptions;

public class EmailJaCadastradoException extends RuntimeException {

    public EmailJaCadastradoException() {
        super("E-mail já cadastrado.");
    }
}
