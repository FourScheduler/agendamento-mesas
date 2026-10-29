package br.com.foursys.agendamento_mesas.exceptions;

public class ReservaJaCanceladaException extends RuntimeException {
    public ReservaJaCanceladaException(Long idReserva) {
        super("Reserva " + idReserva + " já está cancelada.");
    }
}
