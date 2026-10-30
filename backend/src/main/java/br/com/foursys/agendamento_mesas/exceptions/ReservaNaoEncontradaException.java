package br.com.foursys.agendamento_mesas.exceptions;

public class ReservaNaoEncontradaException extends RuntimeException {
    public ReservaNaoEncontradaException(Long idReserva) {
        super("Reserva " + idReserva + " não encontrada.");
    }
}
