package br.com.foursys.agendamento_mesas.dto.response;

import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.model.Reserva;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record ReservaResponse(
    Long mesaId,
    Long usuarioId,
    LocalDate data,
    StatusReserva status,
    LocalDateTime criadaEm,
    LocalDateTime confirmadaEm,
    LocalDateTime canceladaEm
) {
    public static ReservaResponse toResponse(Reserva reserva) {
        return new ReservaResponse(
            reserva.getId(),
            reserva.getUsuario().getId(),
            reserva.getData(),
            reserva.getStatus(),
            reserva.getCriadaEm(),
            reserva.getConfirmadaEm(),
            reserva.getCanceladaEm()
        );
    }
}
