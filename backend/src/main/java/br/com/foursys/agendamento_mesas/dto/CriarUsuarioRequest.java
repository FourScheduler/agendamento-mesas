package br.com.foursys.agendamento_mesas.dto;

import br.com.foursys.agendamento_mesas.enums.PerfilUsuario;

/**
 * Contrato do request de POST /api/admin/usuarios. `perfil` opcional,
 * ausente significa USUARIO.
 */
public record CriarUsuarioRequest(String nome, String email, String senha, PerfilUsuario perfil) {
}
