package br.com.foursys.agendamento_mesas.exceptions;

public class UsuarioComReservaNaDataException extends RuntimeException {
    private final Long mesaId;
    private final String codigoMesa;

    public UsuarioComReservaNaDataException(Long mesaId, String codigoMesa) {
        super("Você já tem uma reserva para a mesa " + codigoMesa + ".");
        this.mesaId = mesaId;
        this.codigoMesa = codigoMesa;
    }

    public Long getMesaId() {
        return mesaId;
    }

    public String getCodigoMesa() {
        return codigoMesa;
    }
}
