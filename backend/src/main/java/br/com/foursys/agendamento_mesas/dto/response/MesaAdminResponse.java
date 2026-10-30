package br.com.foursys.agendamento_mesas.dto.response;

import br.com.foursys.agendamento_mesas.dto.UsuarioResponsavelResumo;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Mesa;

public record MesaAdminResponse(Long id, String codigo, String regiao, TipoMesa tipo, boolean ativa,
                                UsuarioResponsavelResumo responsavel) {
    public static MesaAdminResponse de(Mesa mesa) {
        return new MesaAdminResponse(mesa.getId(), mesa.getCodigo(), mesa.getRegiao(), mesa.getTipo(),
                mesa.isAtiva(), mesa.getResponsavel() == null ? null : UsuarioResponsavelResumo.de(mesa.getResponsavel()));
    }
}
