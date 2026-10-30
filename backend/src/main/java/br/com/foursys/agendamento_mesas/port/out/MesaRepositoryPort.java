package br.com.foursys.agendamento_mesas.port.out;

import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Mesa;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Component
public interface MesaRepositoryPort {
    Mesa salvar(Mesa mesa);

    void salvarESincronizar(Mesa mesa);

    Optional<Mesa> buscarPorId(Long id);

    Optional<Mesa> buscarPorCodigo(String codigo);

    Optional<Mesa> buscarParaReserva(Long id);

    List<Mesa> buscarTodosPorCodigoAsc();

    List<Mesa> buscarPorTrechoCodigoAsc(String termo);

    List<Mesa> buscarPorTrechoCodigoOuRegiaoAsc(String termo);

    List<Mesa> buscarMesasDisponiveis(
        LocalDate data,
        TipoMesa tipo,
        Collection<StatusReserva> bloqueios
    );

    void deletarTodos();

    long contar();

    boolean existePorCodigo(String codigo);
}
