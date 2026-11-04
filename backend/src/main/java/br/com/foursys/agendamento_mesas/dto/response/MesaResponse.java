package br.com.foursys.agendamento_mesas.dto.response;

import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Mesa;
import br.com.foursys.agendamento_mesas.model.Usuario;

public record MesaResponse(
    Long id,
    String codigo,
    String regiao,
    TipoMesa tipo,
    boolean ativa,
    String ocupante,
    UsuarioResponsavel responsavel,
    ReferenciaVisual referenciaVisual
) {
    public record UsuarioResponsavel(Long id, String nome, String email) {}
    public record ReferenciaVisual(String planta, Integer x, Integer y) {}

    public static MesaResponse de(Mesa mesa) {
        Usuario responsavel = mesa.getResponsavel();
        return new MesaResponse(
            mesa.getId(),
            mesa.getCodigo(),
            mesa.getRegiao(),
            mesa.getTipo(),
            mesa.isAtiva(),
            mesa.getOcupante(),
            responsavel == null ? null
                : new UsuarioResponsavel(responsavel.getId(), responsavel.getNome(), responsavel.getEmail()),
            new ReferenciaVisual(
                mesa.getPlanta(),
                mesa.getPosicaoX(),
                mesa.getPosicaoY()));
    }
}
