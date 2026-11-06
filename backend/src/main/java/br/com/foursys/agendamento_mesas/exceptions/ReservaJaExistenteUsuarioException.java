package br.com.foursys.agendamento_mesas.exceptions;

import java.time.LocalDate;

public class ReservaJaExistenteUsuarioException extends RuntimeException {
    private final Long reservaId;
    private final LocalDate data;
    private final Long mesaId;
    private final String codigoMesa;

    public ReservaJaExistenteUsuarioException(Long reservaId, LocalDate data, Long mesaId,
                                             String codigoMesa, String mensagem) {
        super(mensagem);
        this.reservaId = reservaId;
        this.data = data;
        this.mesaId = mesaId;
        this.codigoMesa = codigoMesa;
    }

    public Long getReservaId() { return reservaId; }
    public LocalDate getData() { return data; }
    public Long getMesaId() { return mesaId; }
    public String getCodigoMesa() { return codigoMesa; }
}
