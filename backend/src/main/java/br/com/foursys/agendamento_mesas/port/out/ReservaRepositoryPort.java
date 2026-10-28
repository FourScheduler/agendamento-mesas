package br.com.foursys.agendamento_mesas.port.out;

import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.model.Reserva;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Component
public interface ReservaRepositoryPort {
    Collection<StatusReserva> BLOQUEIA_MESA = List.of(StatusReserva.PENDENTE, StatusReserva.CONFIRMADA);

    void salvar(Reserva reserva);

    Reserva salvarESincronizar(Reserva reserva);

    Optional<Reserva> buscarPorId(Long usuarioId);

    List<Reserva> buscarTodos();

    List<Reserva> listarMinhas(
        @Param("usuarioId") Long usuarioId,
        @Param("inicio") LocalDate inicio,
        @Param("fim") LocalDate fim,
        @Param("status") StatusReserva status
    );

    void deletarTodos();

    boolean usuarioTemReservaNaData(
        @Param("usuarioId") Long usuarioId,
        @Param("data") LocalDate data,
        @Param("bloqueios") Collection<StatusReserva> bloqueios
    );

    boolean mesaOcupadaNaData(
        @Param("mesaId") Long mesaId,
        @Param("data") LocalDate data,
        @Param("bloqueios") Collection<StatusReserva> bloqueios
    );

    void sincronizar();

    long contar();
}
