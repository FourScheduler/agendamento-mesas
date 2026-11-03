package br.com.foursys.agendamento_mesas.dto.request;

import java.time.LocalDate;

public record CriarReservaRequest(
    Long mesaId,
    LocalDate data,
    Long solicitanteId
) {
}
