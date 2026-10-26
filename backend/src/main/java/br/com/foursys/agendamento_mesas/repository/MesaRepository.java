package br.com.foursys.agendamento_mesas.repository;

import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Mesa;

import java.time.LocalDate;
import java.util.Collection;
import java.util.Optional;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MesaRepository extends JpaRepository<Mesa, Long> {

    List<Mesa> findAllByOrderByCodigoAsc();

    Optional<Mesa> findByCodigo(String codigo);

    boolean existsByCodigo(String codigo);

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
            AND r.canceladaEm IS NULL
      )
    """)
    List<Mesa> buscarMesasDisponiveis(
        @Param("data") LocalDate data,
        @Param("tipo") TipoMesa tipo,
        @Param("bloqueios") Collection<StatusReserva> bloqueios
    );
}
