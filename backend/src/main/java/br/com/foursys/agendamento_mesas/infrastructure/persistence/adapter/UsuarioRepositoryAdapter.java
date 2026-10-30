package br.com.foursys.agendamento_mesas.infrastructure.persistence.adapter;

import br.com.foursys.agendamento_mesas.dto.UsuarioAdminResumo;
import br.com.foursys.agendamento_mesas.infrastructure.persistence.repository.UsuarioJpaRepository;
import br.com.foursys.agendamento_mesas.model.Usuario;
import br.com.foursys.agendamento_mesas.port.out.UsuarioRepositoryPort;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class UsuarioRepositoryAdapter implements UsuarioRepositoryPort {
    private final UsuarioJpaRepository usuarioJpaRepository;

    public UsuarioRepositoryAdapter(UsuarioJpaRepository usuarioJpaRepository) {
        this.usuarioJpaRepository = usuarioJpaRepository;
    }

    @Override
    public Usuario salvar(Usuario usuario) {
        return usuarioJpaRepository.save(usuario);
    }

    @Override
    public void salvarESincronizar(Usuario usuario) {
        usuarioJpaRepository.saveAndFlush(usuario);
    }

    @Override
    public Optional<Usuario> buscarPorId(Long id) {
        return usuarioJpaRepository.findById(id);
    }

    @Override
    public Optional<Usuario> buscarPorEmail(String email) {
        return usuarioJpaRepository.findByEmail(email);
    }

    @Override
    public void deletarTodos() {
        usuarioJpaRepository.deleteAll();
    }

    @Override
    public boolean existePorEmail(String email) {
        return usuarioJpaRepository.existsByEmail(email);
    }

    @Override
    public Optional<Usuario> buscarParaReserva(Long id) {
        return usuarioJpaRepository.buscarParaReserva(id);
    }

    @Override
    public long contarUsuarios() {
        return usuarioJpaRepository.count();
    }

    @Override
    public List<UsuarioAdminResumo> listarAtivos() {
        return  usuarioJpaRepository.findAllAtivos().stream().map(u -> new UsuarioAdminResumo(u.getId(), u.getNome(), u.getEmail(), u.getPapel(), u.isAtivo())).toList();
    }

    @Override
    public List<Usuario> findByAtivoTrueOrderByNomeAscIdAsc() {
        return usuarioJpaRepository.findByAtivoTrueOrderByNomeAscIdAsc();
    }
}