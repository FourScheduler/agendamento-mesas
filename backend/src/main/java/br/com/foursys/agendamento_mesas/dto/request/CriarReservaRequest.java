package br.com.foursys.agendamento_mesas.dto.request;

import java.time.LocalDate;

/** A autoria é obtida exclusivamente do contexto autenticado. */
public record CriarReservaRequest(Long mesaId, LocalDate data, Long solicitanteId) {
}
