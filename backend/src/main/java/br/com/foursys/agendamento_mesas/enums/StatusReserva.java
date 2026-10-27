package br.com.foursys.agendamento_mesas.enums;

/**
 * Novas reservas são CONFIRMADA. PENDENTE permanece compatível com dados legados;
 * CANCELADA é o estado final que libera mesa e usuário na data.
 */
public enum StatusReserva {
    PENDENTE,
    CONFIRMADA,
    CANCELADA
}
