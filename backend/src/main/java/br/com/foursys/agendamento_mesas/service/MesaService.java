package br.com.foursys.agendamento_mesas.service;

import br.com.foursys.agendamento_mesas.dto.MesaResponse;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Mesa;
import br.com.foursys.agendamento_mesas.repository.MesaRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class MesaService {
    private final MesaRepository mesas;

    public MesaService(MesaRepository mesas) {
        this.mesas = mesas;
    }

    public List<MesaResponse> listar() {
        return mesas.findAllByOrderByCodigoAsc().stream().map(MesaResponse::de).toList();
    }

    /** Elegibilidade do catálogo. O fluxo de reserva deve ainda validar o período e conflitos. */
    public Mesa obterParaReserva(Long id) {
        Mesa mesa = mesas.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Mesa " + id + " não encontrada."));
        if (!mesa.isAtiva()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Mesa " + mesa.getCodigo() + " está inativa.");
        }
        if (mesa.getTipo() != TipoMesa.LIVRE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Mesa " + mesa.getCodigo() + " é fixa e não pode ser reservada.");
        }
        return mesa;
    }
}
