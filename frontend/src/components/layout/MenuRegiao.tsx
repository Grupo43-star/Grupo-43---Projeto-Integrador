import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, ChevronDown, Home, LoaderCircle, MapPin, RotateCw, Search, X } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { usePainel } from '../../hooks/usePainel'
import { acharBairro, listarRegioes, type Regiao } from '../../services/calendario'
import { bairroDoUsuario, normalizarTexto } from '../../utils/formatar'

const LIMITE_BUSCA = 60

interface Bairro {
  nome: string
  cidade: string
  uf: string
  regiao: string
}

/** Todos os bairros atendidos (GET /regions), em ordem alfabética. */
function bairrosDas(regioes: Regiao[]): Bairro[] {
  return regioes
    .flatMap((r) => r.bairros.map((nome) => ({ nome, cidade: r.cidade, uf: r.uf, regiao: r.nome })))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.cidade.localeCompare(b.cidade, 'pt-BR'))
}

/**
 * Botão "Explorar bairros" da topbar: lista os bairros atendidos pela coleta seletiva
 * (GET /regions) e abre o calendário do bairro escolhido (/calendario?bairro=&cidade=).
 */
export default function MenuRegiao() {
  const { usuario } = useAuth()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { aberto, raiz, botao, alternar: alternarPainel, fechar } = usePainel()
  const [busca, setBusca] = useState('')

  // ---------- Regiões ----------
  const [regioes, setRegioes] = useState<Regiao[]>([])
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    listarRegioes()
      .then((lista) => {
        if (!ativo) return
        setRegioes(lista)
        setEstado('pronto')
      })
      .catch(() => {
        if (ativo) setEstado('erro')
      })
    return () => {
      ativo = false
    }
  }, [tentativa])

  function tentarDeNovo() {
    setEstado('carregando')
    setTentativa((n) => n + 1)
  }

  const bairros = bairrosDas(regioes)
  const meuBairro = bairroDoUsuario(usuario)

  // O botão mostra o bairro escolhido no Calendário; fora dele, o bairro do endereço
  const parametros = new URLSearchParams(search)
  const noCalendario = pathname === '/calendario'
  const bairroParam = noCalendario ? parametros.get('bairro')?.trim() || null : null
  const cidadeParam = parametros.get('cidade')
  const achado = bairroParam ? acharBairro(regioes, bairroParam, cidadeParam) : null
  const bairroNaTela = achado ? achado.bairro : bairroParam
  const cidadeNaTela = achado ? achado.regiao.cidade : cidadeParam
  const rotulo = bairroNaTela ?? meuBairro ?? 'Explorar bairros'

  const termo = normalizarTexto(busca)
  const visiveis = bairros.filter(
    (b) => !termo || normalizarTexto(`${b.nome} ${b.cidade} ${b.regiao}`).includes(termo),
  )

  function alternar() {
    if (!aberto) setBusca('')
    if (!aberto && estado === 'erro') tentarDeNovo()
    alternarPainel()
  }

  /** Sem bairro: o Calendário volta para o endereço da pessoa (ou pede para escolher). */
  function escolher(bairro: Bairro | null) {
    fechar()
    if (!bairro) {
      navigate('/calendario')
      return
    }
    const novos = new URLSearchParams({ bairro: bairro.nome, cidade: bairro.cidade })
    navigate(`/calendario?${novos.toString()}`)
  }

  const ehAtual = (b: Bairro) =>
    b.nome === bairroNaTela && (!cidadeNaTela || b.cidade === cidadeNaTela)
  const meuEnderecoNaTela = noCalendario && !bairroParam && Boolean(meuBairro)

  return (
    <div className="painel-topbar" ref={raiz}>
      <button
        ref={botao}
        type="button"
        className="topbar__regiao"
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-controls="menu-regiao"
        aria-label={`Explorar bairros. Atual: ${rotulo}`}
        onClick={alternar}
      >
        <MapPin size={15} aria-hidden="true" />
        <span>{rotulo}</span>
        <ChevronDown size={15} aria-hidden="true" className={aberto ? 'girar-180' : ''} />
      </button>

      {aberto && (
        <div id="menu-regiao" className="painel regiao" role="dialog" aria-label="Explorar bairros">
          <div className="painel__topo">
            <p className="painel__titulo">Explorar bairros</p>
            <p className="painel__descricao">
              Bairros onde a coleta seletiva passa. Escolha um para ver o calendário.
            </p>
          </div>

          <div className="input-com-icone regiao__busca">
            <Search size={15} className="input-com-icone__icone" aria-hidden="true" />
            <input
              className="input"
              placeholder="Buscar bairro ou cidade"
              aria-label="Buscar bairro ou cidade"
              maxLength={LIMITE_BUSCA}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              autoFocus
            />
          </div>

          <ul className="regiao__lista">
            {meuBairro && !termo && (
              <li>
                <button
                  type="button"
                  className="regiao__opcao regiao__opcao--meu"
                  aria-current={meuEnderecoNaTela ? 'true' : undefined}
                  onClick={() => escolher(null)}
                >
                  <Home size={15} aria-hidden="true" />
                  <span className="regiao__nome">
                    <strong>Meu bairro</strong>
                    <small>{meuBairro}</small>
                  </span>
                  {meuEnderecoNaTela && (
                    <Check size={15} className="regiao__check" aria-hidden="true" />
                  )}
                </button>
              </li>
            )}
            {visiveis.map((b) => {
              const atual = ehAtual(b)
              return (
                <li key={`${b.nome}|${b.cidade}`}>
                  <button
                    type="button"
                    className="regiao__opcao"
                    aria-current={atual ? 'true' : undefined}
                    onClick={() => escolher(b)}
                  >
                    <MapPin size={15} aria-hidden="true" />
                    <span className="regiao__nome">
                      <strong>{b.nome}</strong>
                      <small>
                        {b.cidade}/{b.uf} · região {b.regiao}
                      </small>
                    </span>
                    {atual && <Check size={15} className="regiao__check" aria-hidden="true" />}
                  </button>
                </li>
              )
            })}
          </ul>

          {estado === 'carregando' && (
            <p className="painel__vazio" aria-busy="true">
              <LoaderCircle size={15} className="girando" aria-hidden="true" /> Carregando bairros...
            </p>
          )}
          {estado === 'erro' && (
            <div className="painel__vazio" role="alert">
              <p>Não foi possível carregar os bairros agora.</p>
              <button type="button" className="painel__acao" onClick={tentarDeNovo}>
                <RotateCw size={13} aria-hidden="true" /> Tentar novamente
              </button>
            </div>
          )}
          {estado === 'pronto' && visiveis.length === 0 && (
            <p className="painel__vazio">
              {termo
                ? `Nenhum bairro atendido encontrado para "${busca}".`
                : 'Ainda não há bairros atendidos pela coleta seletiva.'}
            </p>
          )}

          {bairroParam && (
            <button type="button" className="painel__rodape-btn" onClick={() => escolher(null)}>
              <X size={14} aria-hidden="true" />{' '}
              {meuBairro ? 'Voltar para o meu endereço' : 'Tirar o bairro escolhido'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
