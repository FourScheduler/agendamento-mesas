package br.com.foursys.agendamento_mesas.port.out;

import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.model.Reserva;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Component
public interface ReservaRepositoryPort {
    Collection<StatusReserva> BLOQUEIA_MESA = List.of(StatusReserva.PENDENTE, StatusReserva.CONFIRMADA);

    void salvar(Reserva reserva);

    Reserva salvarESincronizar(Reserva reserva);

    Optional<Reserva> buscarPorId(Long usuarioId);

    Optional<Long> buscarUsuarioId(Long reservaId);

    Optional<Reserva> buscarPorAutorEChave(Long autorId, String chave);

    int excluirCanceladasAte(LocalDateTime limite, int tamanhoLote);

    List<Reserva> buscarTodos();

    Page<Reserva> listarPagina(Long usuarioId, LocalDate inicio, LocalDate fim,
        Collection<StatusReserva> status, Pageable pagina);

    List<Reserva> buscarOcupacoesNaData(LocalDate data, Collection<Long> mesaIds,
        Collection<StatusReserva> bloqueios);

    List<Reserva> listarTodas(
        @Param("inicio") LocalDate inicio,
        @Param("fim") LocalDate fim,
        @Param("status") StatusReserva status
    );

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

    Optional<Reserva> buscarReservaDoUsuarioNaData(Long usuarioId, LocalDate data,
        Collection<StatusReserva> bloqueios);

    boolean mesaOcupadaNaData(
        @Param("mesaId") Long mesaId,
        @Param("data") LocalDate data,
        @Param("bloqueios") Collection<StatusReserva> bloqueios
    );

    boolean mesaTemReservasDesde(Long mesaId, LocalDate inicio, Collection<StatusReserva> bloqueios);

    boolean usuarioTemReservasDesde(Long usuarioId, LocalDate inicio, Collection<StatusReserva> bloqueios);

    void sincronizar();

    long contar();
}
