package br.com.foursys.agendamento_mesas.infrastructure.persistence.adapter;

import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.infrastructure.persistence.repository.MesaJpaRepository;
import br.com.foursys.agendamento_mesas.model.Mesa;
import br.com.foursys.agendamento_mesas.port.out.MesaRepositoryPort;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Component
public class MesaRepositoryAdapter implements MesaRepositoryPort {
    private final MesaJpaRepository mesaRepository;

    public MesaRepositoryAdapter(MesaJpaRepository mesaRepository) {
        this.mesaRepository = mesaRepository;
    }

    @Override
    public Mesa salvar(Mesa mesa) {
        return mesaRepository.save(mesa);
    }

    @Override
    public void salvarESincronizar(Mesa mesa) {
        mesaRepository.saveAndFlush(mesa);
    }

    @Override
    public Optional<Mesa> buscarPorId(Long id) {
        return mesaRepository.findById(id);
    }

    @Override
    public Optional<Mesa> buscarParaReserva(Long id) {
        return mesaRepository.buscarParaReserva(id);
    }

    @Override
    public List<Mesa> buscarTodosPorCodigoAsc() {
        return mesaRepository.findAllByOrderByCodigoAsc();
    }

    @Override
    public Optional<Mesa> buscarPorCodigo(String codigo) {
        return mesaRepository.findByCodigo(codigo);
    }

    @Override
    public List<Mesa> buscarMesasDisponiveis(LocalDate data, TipoMesa tipo, Collection<StatusReserva> bloqueios) {
        return mesaRepository.buscarMesasDisponiveis(data, tipo, bloqueios);
    }

    @Override
    public long contar() {
        return mesaRepository.count();
    }

    @Override
    public void deletarTodos() {
        mesaRepository.deleteAll();
    }

    @Override
    public boolean existePorCodigo(String codigo) {
        return mesaRepository.existsByCodigo(codigo);
    }
}
