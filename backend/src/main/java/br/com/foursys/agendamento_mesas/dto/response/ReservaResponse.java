package br.com.foursys.agendamento_mesas.dto.response;

import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.model.Reserva;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record ReservaResponse(Long id, LocalDate data, StatusReserva status,
                              LocalDateTime criadaEm, LocalDateTime confirmadaEm,
                              MesaResumo mesa, SolicitanteResumo solicitante) {
    public record MesaResumo(Long id, String codigo, String regiao) {}
    public record SolicitanteResumo(Long id, String nome, String email) {}

    public static ReservaResponse de(Reserva reserva) {
        var mesa = reserva.getMesa();
        var usuario = reserva.getUsuario();
        return new ReservaResponse(reserva.getId(), reserva.getData(), reserva.getStatus(),
                reserva.getCriadaEm(), reserva.getConfirmadaEm(),
                new MesaResumo(mesa.getId(), mesa.getCodigo(), mesa.getRegiao()),
                new SolicitanteResumo(usuario.getId(), usuario.getNome(), usuario.getEmail()));
    }
}
