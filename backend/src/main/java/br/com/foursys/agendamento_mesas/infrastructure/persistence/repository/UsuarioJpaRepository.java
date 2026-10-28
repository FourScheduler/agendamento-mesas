package br.com.foursys.agendamento_mesas.infrastructure.persistence.repository;

import br.com.foursys.agendamento_mesas.model.Usuario;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UsuarioJpaRepository extends JpaRepository<Usuario, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from Usuario u where u.id = :id")
    Optional<Usuario> buscarParaReserva(@Param("id") Long id);

    Optional<Usuario> findByEmail(String email);

    boolean existsByEmail(String email);
}
