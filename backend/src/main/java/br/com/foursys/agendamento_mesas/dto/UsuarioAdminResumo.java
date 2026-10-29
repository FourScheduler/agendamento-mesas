package br.com.foursys.agendamento_mesas.dto;

import br.com.foursys.agendamento_mesas.enums.PerfilUsuario;

public record UsuarioAdminResumo(
    Long id,
    String nome,
    String email,
    PerfilUsuario perfil,
    boolean ativo
) {
}
