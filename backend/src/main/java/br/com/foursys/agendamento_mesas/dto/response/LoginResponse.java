package br.com.foursys.agendamento_mesas.dto.response;

import br.com.foursys.agendamento_mesas.dto.UsuarioResumo;

public record LoginResponse(
    String token,
    String tipo,
    UsuarioResumo usuario
) {

    public static LoginResponse comToken(String token, UsuarioResumo usuario) {
        return new LoginResponse(token, "Bearer", usuario);
    }
}
