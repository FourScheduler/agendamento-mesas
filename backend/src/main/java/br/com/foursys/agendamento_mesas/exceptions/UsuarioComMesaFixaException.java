package br.com.foursys.agendamento_mesas.exceptions;

public class UsuarioComMesaFixaException extends RuntimeException {
    private final Long mesaId;
    private final String codigoMesa;

    public UsuarioComMesaFixaException(Long mesaId, String codigoMesa, String mensagem) {
        super(mensagem);
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
