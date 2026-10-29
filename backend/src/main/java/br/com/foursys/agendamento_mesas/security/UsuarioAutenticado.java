package br.com.foursys.agendamento_mesas.security;

import br.com.foursys.agendamento_mesas.enums.PerfilUsuario;

public record UsuarioAutenticado(
    Long id,
    String nome,
    String email,
    PerfilUsuario perfil
) {
}
