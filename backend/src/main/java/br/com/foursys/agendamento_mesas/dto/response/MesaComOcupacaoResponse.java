package br.com.foursys.agendamento_mesas.dto.response;

import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Reserva;

public record MesaComOcupacaoResponse(
    Long id,
    String codigo,
    String regiao,
    TipoMesa tipo,
    boolean ativa,
    String ocupante,
    MesaResponse.UsuarioResponsavel responsavel,
    ReferenciaVisual referenciaVisual,
    boolean ocupada,
    OcupanteNaData ocupanteNaData
) {
    public record ReferenciaVisual(String planta, Integer x, Integer y) {}
    public record OcupanteNaData(Long id, String nome, String email) {}

    public static MesaComOcupacaoResponse de(MesaResponse mesa, Reserva reserva) {
        OcupanteNaData ocupanteNaData = reserva == null ? null : new OcupanteNaData(
            reserva.getUsuario().getId(), reserva.getUsuario().getNome(), reserva.getUsuario().getEmail());
        return new MesaComOcupacaoResponse(
            mesa.id(),
            mesa.codigo(),
            mesa.regiao(),
            mesa.tipo(),
            mesa.ativa(),
            mesa.ocupante(),
            mesa.responsavel(),
            new ReferenciaVisual(
                mesa.referenciaVisual().planta(),
                mesa.referenciaVisual().x(),
                mesa.referenciaVisual().y()
            ),
            reserva != null,
            ocupanteNaData
        );
    }
}
