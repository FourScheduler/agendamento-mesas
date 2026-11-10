import { LoggingService } from './logging.service';
import { environment } from '../../../environments/environment';

describe('LoggingService', () => {
  afterEach(() => vi.restoreAllMocks());
  it('descarta senha, token e dados pessoais que não pertencem ao contexto permitido', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    new LoggingService().registrar('WARN', 'Operação pendente', {
      correlationId: 'correlacao', status: 0, senha: 'secreta', token: 'segredo', email: 'pessoa@example.com',
    } as never);
    expect(spy).toHaveBeenCalledWith('[WARN] Operação pendente', { correlationId: 'correlacao', status: 0 });
  });
  it('produção não emite DEBUG/INFO', () => {
    const original = environment.production;
    environment.production = true;
    try {
      const debug = vi.spyOn(console, 'debug'), info = vi.spyOn(console, 'info');
      const service = new LoggingService(); service.registrar('DEBUG', 'Operação'); service.registrar('INFO', 'Operação');
      expect(debug).not.toHaveBeenCalled(); expect(info).not.toHaveBeenCalled();
    } finally { environment.production = original; }
  });
});
