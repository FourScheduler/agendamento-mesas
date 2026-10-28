package br.com.foursys.agendamento_mesas.exceptions;

public class UsuarioSemPermissaoException extends RuntimeException {
    public UsuarioSemPermissaoException() {
        super("O usuário sem permissão para realizar essa ação.");
    }
}
