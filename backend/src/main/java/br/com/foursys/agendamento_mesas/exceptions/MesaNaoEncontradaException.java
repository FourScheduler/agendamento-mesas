package br.com.foursys.agendamento_mesas.exceptions;

public class MesaNaoEncontradaException extends RuntimeException {
    public MesaNaoEncontradaException() {
        super("Mesa não encontrada.");
    }
}
