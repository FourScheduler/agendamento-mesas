package br.com.foursys.agendamento_mesas.dto.response;

import br.com.foursys.agendamento_mesas.enums.TipoMesa;

public record MesaComOcupacaoResponse(
    Long id,
    String codigo,
    String regiao,
    TipoMesa tipo,
    boolean ativa,
    String ocupante,
    ReferenciaVisual referenciaVisual,
    boolean ocupada
) {
    public record ReferenciaVisual(String planta, Integer x, Integer y) {}

    public static MesaComOcupacaoResponse de(MesaResponse mesa, boolean ocupada) {
        return new MesaComOcupacaoResponse(
            mesa.id(),
            mesa.codigo(),
            mesa.regiao(),
            mesa.tipo(),
            mesa.ativa(),
            mesa.ocupante(),
            new ReferenciaVisual(
                mesa.referenciaVisual().planta(),
                mesa.referenciaVisual().x(),
                mesa.referenciaVisual().y()
            ),
            ocupada
        );
    }
}