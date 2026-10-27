package br.com.foursys.agendamento_mesas.security;

import br.com.foursys.agendamento_mesas.enums.PerfilUsuario;

/**
 * Identidade do usuário autenticado no contexto de segurança.
 * Carregada do banco a cada request a partir do token JWT.
 */
public record UsuarioAutenticado(Long id, String nome, String email, PerfilUsuario perfil) {
}
