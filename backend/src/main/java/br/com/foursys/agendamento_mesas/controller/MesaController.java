package br.com.foursys.agendamento_mesas.controller;

import br.com.foursys.agendamento_mesas.dto.MesaResponse;
import br.com.foursys.agendamento_mesas.service.MesaService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mesas")
public class MesaController {
    private final MesaService mesas;

    public MesaController(MesaService mesas) {
        this.mesas = mesas;
    }

    @GetMapping
    public List<MesaResponse> listar() {
        return mesas.listar();
    }
}
