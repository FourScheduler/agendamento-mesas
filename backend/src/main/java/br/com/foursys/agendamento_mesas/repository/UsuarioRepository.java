package br.com.foursys.agendamento_mesas.repository;

import br.com.foursys.agendamento_mesas.model.Usuario;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from Usuario u where u.id = :id")
    Optional<Usuario> buscarParaReserva(@Param("id") Long id);

    Optional<Usuario> findByEmail(String email);

    boolean existsByEmail(String email);

    @Query("select u from Usuario u where u.ativo = true order by u.nome")
    List<Usuario> findAllAtivos();
}
