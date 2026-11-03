package br.com.foursys.agendamento_mesas.port.out;

import br.com.foursys.agendamento_mesas.dto.UsuarioAdminResumo;
import br.com.foursys.agendamento_mesas.model.Usuario;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public interface UsuarioRepositoryPort {
    Usuario salvar(Usuario usuario);

    void salvarESincronizar(Usuario usuario);

    Optional<Usuario> buscarPorId(Long id);

    Optional<Usuario> buscarPorEmail(String email);

    void deletarTodos();

    boolean existePorEmail(String email);

    Optional<Usuario> buscarParaReserva(@Param("id") Long id);

    long contarUsuarios();

    List<UsuarioAdminResumo> listarAtivos();

    List<UsuarioAdminResumo> buscarAtivosPorTermo(String termo);
}
