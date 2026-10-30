package br.com.foursys.agendamento_mesas.dto;

import br.com.foursys.agendamento_mesas.model.Usuario;

/** Dados mínimos para seleção e identificação do responsável, sem credenciais. */
public record UsuarioResponsavelResumo(Long id, String nome, String email) {
    public static UsuarioResponsavelResumo de(Usuario usuario) {
        return new UsuarioResponsavelResumo(usuario.getId(), usuario.getNome(), usuario.getEmail());
    }
}
