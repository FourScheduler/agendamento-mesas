package br.com.foursys.agendamento_mesas.controller;

import br.com.foursys.agendamento_mesas.dto.request.AlterarAtivacaoMesaRequest;
import br.com.foursys.agendamento_mesas.dto.request.AtribuirResponsavelRequest;
import br.com.foursys.agendamento_mesas.dto.response.MesaAdminResponse;
import br.com.foursys.agendamento_mesas.service.MesaAdminService;
import java.util.List;
import org.springframework.web.bind.annotation.*;

/** Todas as rotas são restritas a ADMIN pela SecurityConfig. */
@RestController
@RequestMapping("/api/admin/mesas")
public class MesaAdminController {
    private final MesaAdminService mesas;

    public MesaAdminController(MesaAdminService mesas) {
        this.mesas = mesas;
    }

    @GetMapping
    public List<MesaAdminResponse> listar() {
        return mesas.listar();
    }

    @PutMapping("/{id}/responsavel")
    public MesaAdminResponse atribuir(@PathVariable Long id, @RequestBody AtribuirResponsavelRequest request) {
        return mesas.atribuir(id, request);
    }

    @DeleteMapping("/{id}/responsavel")
    public MesaAdminResponse desfixar(@PathVariable Long id) {
        return mesas.desfixar(id);
    }

    @PatchMapping("/{id}/estado")
    public MesaAdminResponse alterarAtivacao(@PathVariable Long id, @RequestBody AlterarAtivacaoMesaRequest request) {
        return mesas.alterarAtivacao(id, request);
    }
}
