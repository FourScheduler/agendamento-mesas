package br.com.foursys.agendamento_mesas.dto.response;

import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.model.Reserva;

import java.time.LocalDate;

public record ReservaMapaResponse(
    Long id,
    StatusReserva status,
    LocalDate data,
    MesaResumo mesa,
    SolicitanteResumo solicitante
) {
    public record MesaResumo(Long id, String codigo, String regiao) {}
    public record SolicitanteResumo(Long id, String nome) {}

    public static ReservaMapaResponse toResponse(Reserva reserva) {
        return new ReservaMapaResponse(
            reserva.getId(),
            reserva.getStatus(),
            reserva.getData(),
            new MesaResumo(reserva.getMesa().getId(), reserva.getMesa().getCodigo(), reserva.getMesa().getRegiao()),
            new SolicitanteResumo(reserva.getUsuario().getId(), reserva.getUsuario().getNome())
        );
    }
}
