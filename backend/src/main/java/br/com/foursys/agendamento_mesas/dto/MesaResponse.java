package br.com.foursys.agendamento_mesas.dto;

import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Mesa;

public record MesaResponse(Long id, String codigo, String regiao, TipoMesa tipo,
                           boolean ativa, ReferenciaVisual referenciaVisual) {
    public record ReferenciaVisual(String planta, Integer x, Integer y) {}

    public static MesaResponse de(Mesa mesa) {
        return new MesaResponse(mesa.getId(), mesa.getCodigo(), mesa.getRegiao(), mesa.getTipo(),
                mesa.isAtiva(), new ReferenciaVisual(mesa.getPlanta(), mesa.getPosicaoX(), mesa.getPosicaoY()));
    }
}
