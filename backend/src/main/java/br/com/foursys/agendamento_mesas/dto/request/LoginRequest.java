package br.com.foursys.agendamento_mesas.dto.request;

/**
 * Contrato do request de POST /api/auth/login.
 */
public record LoginRequest(
    String email,
    String senha
) {
}
