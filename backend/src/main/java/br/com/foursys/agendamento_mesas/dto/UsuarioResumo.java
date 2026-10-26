package br.com.foursys.agendamento_mesas.dto;

import br.com.foursys.agendamento_mesas.enums.PerfilUsuario;

/**
 * Dados públicos do usuário autenticado (sem senha). Usado no login, no
 * perfil e como base da criação de usuário.
 */
public record UsuarioResumo(
    Long id,
    String nome,
    String email,
    PerfilUsuario perfil
) {
}
