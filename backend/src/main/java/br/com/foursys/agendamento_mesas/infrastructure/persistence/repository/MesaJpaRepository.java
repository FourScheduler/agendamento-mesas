package br.com.foursys.agendamento_mesas.infrastructure.persistence.repository;

import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Mesa;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MesaJpaRepository extends JpaRepository<Mesa, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Mesa m where m.id = :id")
    Optional<Mesa> buscarParaReserva(@Param("id") Long id);

    List<Mesa> findAllByOrderByCodigoAsc();

    Optional<Mesa> findByCodigo(String codigo);

    boolean existsByCodigo(String codigo);

    @Query("select u.id from Mesa m left join m.responsavel u where m.id = :id")
    Optional<Long> buscarResponsavelId(@Param("id") Long id);

    Optional<Mesa> findByResponsavelId(Long usuarioId);

    @Query("select m from Mesa m left join fetch m.responsavel order by m.codigo")
    List<Mesa> buscarTodosComResponsavelPorCodigoAsc();

    @Query("""
    SELECT m
    FROM Mesa m
    WHERE m.ativa = true
      AND m.tipo = :tipo
      AND NOT EXISTS (
          SELECT r
          FROM Reserva r
          WHERE r.mesa.id = m.id
            AND r.data = :data
            AND r.status IN :bloqueios
      )
    ORDER BY m.codigo
    """)
    List<Mesa> buscarMesasDisponiveis(
        @Param("data") LocalDate data,
        @Param("tipo") TipoMesa tipo,
        @Param("bloqueios") Collection<StatusReserva> bloqueios
    );
}
