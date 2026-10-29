package br.com.foursys.agendamento_mesas.dto.request;

import br.com.foursys.agendamento_mesas.enums.PerfilUsuario;

public record CriarUsuarioRequest(
        String nome,
        String email,
        String senha,
        PerfilUsuario perfil
) {
}
