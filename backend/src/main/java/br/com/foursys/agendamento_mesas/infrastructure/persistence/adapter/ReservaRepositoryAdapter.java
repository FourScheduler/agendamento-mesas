package br.com.foursys.agendamento_mesas.infrastructure.persistence.adapter;

import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.infrastructure.persistence.repository.ReservaJpaRepository;
import br.com.foursys.agendamento_mesas.model.Reserva;
import br.com.foursys.agendamento_mesas.port.out.ReservaRepositoryPort;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Component
public class ReservaRepositoryAdapter implements ReservaRepositoryPort {
    private final ReservaJpaRepository reservaJpaRepository;

    public ReservaRepositoryAdapter(ReservaJpaRepository reservaJpaRepository) {
        this.reservaJpaRepository = reservaJpaRepository;
    }

    @Override
    public void salvar(Reserva reserva) {
        reservaJpaRepository.save(reserva);
    }

    @Override
    public Reserva salvarESincronizar(Reserva reserva) {
        return reservaJpaRepository.saveAndFlush(reserva);
    }

    @Override
    public Optional<Reserva> buscarPorId(Long usuarioId) {
        return reservaJpaRepository.findById(usuarioId);
    }

    @Override
    public Optional<Long> buscarUsuarioId(Long reservaId) {
        return reservaJpaRepository.buscarUsuarioId(reservaId);
    }

    @Override
    public List<Reserva> buscarTodos() {
        return reservaJpaRepository.findAll();
    }

    @Override
    public List<Reserva> buscarOcupacoesNaData(LocalDate data, Collection<Long> mesaIds,
            Collection<StatusReserva> bloqueios) {
        return reservaJpaRepository.buscarOcupacoesNaData(data, mesaIds, bloqueios);
    }

    @Override
    public List<Reserva> listarTodas(LocalDate inicio, LocalDate fim, StatusReserva status) {
        return reservaJpaRepository.listarTodas(inicio, fim, status);
    }

    @Override
    public List<Reserva> listarMinhas(Long usuarioId, LocalDate inicio, LocalDate fim, StatusReserva status) {
        return reservaJpaRepository.listarMinhas(usuarioId, inicio, fim, status);
    }

    @Override
    public void deletarTodos() {
        reservaJpaRepository.deleteAll();
    }

    @Override
    public boolean usuarioTemReservaNaData(Long usuarioId, LocalDate data, Collection<StatusReserva> bloqueios) {
        return reservaJpaRepository.usuarioTemReservaNaData(usuarioId, data, bloqueios);
    }

    @Override
    public Optional<Reserva> buscarReservaDoUsuarioNaData(Long usuarioId, LocalDate data,
            Collection<StatusReserva> bloqueios) {
        return reservaJpaRepository.findFirstByUsuarioIdAndDataAndStatusInOrderByIdDesc(usuarioId, data, bloqueios);
    }

    @Override
    public boolean mesaOcupadaNaData(Long mesaId, LocalDate data, Collection<StatusReserva> bloqueios) {
        return reservaJpaRepository.mesaOcupadaNaData(mesaId, data, bloqueios);
    }

    @Override
    public boolean mesaTemReservasDesde(Long mesaId, LocalDate inicio, Collection<StatusReserva> bloqueios) {
        return reservaJpaRepository.mesaTemReservasDesde(mesaId, inicio, bloqueios);
    }

    @Override
    public boolean usuarioTemReservasDesde(Long usuarioId, LocalDate inicio, Collection<StatusReserva> bloqueios) {
        return reservaJpaRepository.usuarioTemReservasDesde(usuarioId, inicio, bloqueios);
    }

    @Override
    public void sincronizar() {
        reservaJpaRepository.flush();
    }

    @Override
    public long contar() {
        return reservaJpaRepository.count();
    }
}
