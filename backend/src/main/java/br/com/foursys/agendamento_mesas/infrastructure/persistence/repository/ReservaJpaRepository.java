package br.com.foursys.agendamento_mesas.infrastructure.persistence.repository;

import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.model.Reserva;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ReservaJpaRepository extends JpaRepository<Reserva, Long> {
    @Query("select r.usuario.id from Reserva r where r.id = :id")
    Optional<Long> buscarUsuarioId(@Param("id") Long id);

    @Query("""
        select r from Reserva r
        join fetch r.usuario
        where r.data = :data and r.mesa.id in :mesaIds and r.status in :bloqueios
        order by r.id desc
        """)
    List<Reserva> buscarOcupacoesNaData(@Param("data") LocalDate data,
        @Param("mesaIds") Collection<Long> mesaIds, @Param("bloqueios") Collection<StatusReserva> bloqueios);

    @Query("""
            select count(r) > 0
            from Reserva r
            where r.mesa.id = :mesaId
              and r.data = :data
              and r.status in :bloqueios
            """)
    boolean mesaOcupadaNaData(
        @Param("mesaId") Long mesaId, @Param("data") LocalDate data,
        @Param("bloqueios") Collection<StatusReserva> bloqueios
    );

    @Query("""
            select count(r) > 0
            from Reserva r
            where r.usuario.id = :usuarioId
              and r.data = :data
              and r.status in :bloqueios
            """)
    boolean usuarioTemReservaNaData(
        @Param("usuarioId") Long usuarioId,
        @Param("data") LocalDate data,
        @Param("bloqueios") Collection<StatusReserva> bloqueios
    );

    @Query("""
        select count(r) > 0 from Reserva r
        where r.mesa.id = :mesaId and r.data >= :inicio and r.status in :bloqueios
        """)
    boolean mesaTemReservasDesde(@Param("mesaId") Long mesaId, @Param("inicio") LocalDate inicio,
        @Param("bloqueios") Collection<StatusReserva> bloqueios);

    @Query("""
        select count(r) > 0 from Reserva r
        where r.usuario.id = :usuarioId and r.data >= :inicio and r.status in :bloqueios
        """)
    boolean usuarioTemReservasDesde(@Param("usuarioId") Long usuarioId, @Param("inicio") LocalDate inicio,
        @Param("bloqueios") Collection<StatusReserva> bloqueios);

    List<Reserva> findByUsuarioIdOrderByDataDesc(Long usuarioId);

    @Query("""
            select r from Reserva r
            join fetch r.mesa
            join fetch r.usuario
            left join fetch r.criadoPor
            where (:inicio is null or r.data >= :inicio)
              and (:fim is null or r.data <= :fim)
              and (:status is null or r.status = :status)
            order by r.data desc, r.id desc
            """)
    List<Reserva> listarTodas(
        @Param("inicio") LocalDate inicio,
        @Param("fim") LocalDate fim,
        @Param("status") StatusReserva status
    );

    List<Reserva> findByUsuarioIdAndDataAndStatusIn(Long usuarioId, LocalDate data, Collection<StatusReserva> status);

    List<Reserva> findByDataOrderByCriadaEmDesc(LocalDate data);

    List<Reserva> findByUsuarioIdAndDataOrderByCriadaEmDesc(Long usuarioId, LocalDate data);

    List<Reserva> findByDataAndStatusInOrderByCriadaEmDesc(LocalDate data, Collection<StatusReserva> status);

    List<Reserva> findByUsuario_Id(Long idUsuario);

    @Query("""
            select r from Reserva r
            join fetch r.mesa
            join fetch r.usuario
            left join fetch r.criadoPor
            where r.usuario.id = :usuarioId
              and (:inicio is null or r.data >= :inicio)
              and (:fim is null or r.data <= :fim)
              and (:status is null or r.status = :status)
            order by r.data desc, r.id desc
            """)
    List<Reserva> listarMinhas(
        @Param("usuarioId") Long usuarioId,
        @Param("inicio") LocalDate inicio,
        @Param("fim") LocalDate fim,
        @Param("status") StatusReserva status
    );
}
