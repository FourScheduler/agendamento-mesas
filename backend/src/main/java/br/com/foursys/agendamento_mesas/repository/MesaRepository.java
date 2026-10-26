package br.com.foursys.agendamento_mesas.repository;

import br.com.foursys.agendamento_mesas.model.Mesa;
import java.util.Optional;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MesaRepository extends JpaRepository<Mesa, Long> {

    List<Mesa> findAllByOrderByCodigoAsc();

    Optional<Mesa> findByCodigo(String codigo);

    boolean existsByCodigo(String codigo);
}
