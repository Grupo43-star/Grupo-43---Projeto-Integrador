import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
import { CircleCheck, LoaderCircle, Lock } from 'lucide-react'
import { ufs, type Endereco } from '../data/usuario'
import { buscarCep, type EnderecoCep } from '../services/cep'

// O mapa (Leaflet) é carregado sob demanda: só baixa nas telas com endereço
const MapaDoEndereco = lazy(() => import('./MapaDoEndereco'))
import {
  filtrarNumero,
  LIMITES,
  mascaraCep,
  SEM_NUMERO,
  type ErrosEndereco,
} from '../utils/validar'

interface Props {
  endereco: Endereco
  erros?: ErrosEndereco
  /** Recebe só os campos que mudaram */
  onAlterar: (parcial: Partial<Endereco>) => void
  /** Chamado quando o CEP é encontrado */
  onCepEncontrado?: (dados: EnderecoCep) => void
  /** Pontos de coleta não têm complemento (gestão de pontos) */
  semComplemento?: boolean
}

type StatusCep = 'ocioso' | 'buscando' | 'encontrado' | 'nao-encontrado' | 'indisponivel'
type CampoDoCep = keyof EnderecoCep // rua, bairro, cidade, uf

const CAMPOS_DO_CEP: CampoDoCep[] = ['rua', 'bairro', 'cidade', 'uf']
/** Campos que definem o local: se mudarem, o pino do mapa precisa ser procurado de novo */
const CAMPOS_DO_LOCAL: (keyof Endereco)[] = ['cep', 'rua', 'numero', 'bairro', 'cidade', 'uf']
const LINK_BUSCA_CEP = 'https://buscacepinter.correios.com.br/app/endereco/index.php'

const mesmoTexto = (a: string, b: string) =>
  a.trim().localeCompare(b.trim(), 'pt-BR', { sensitivity: 'base' }) === 0

export default function CamposEndereco({
  endereco,
  erros = {},
  onAlterar: onAlterarPai,
  onCepEncontrado,
  semComplemento = false,
}: Props) {
  // Mudou o local (não o complemento): limpa as coordenadas para o mapa procurar de novo
  function onAlterar(parcial: Partial<Endereco>) {
    const mudouLocal = CAMPOS_DO_LOCAL.some(
      (campo) => campo in parcial && parcial[campo] !== endereco[campo],
    )
    onAlterarPai(mudouLocal ? { ...parcial, latitude: null, longitude: null } : parcial)
  }

  const [status, setStatus] = useState<StatusCep>('ocioso')
  // Campos preenchidos pelo CEP ficam travados: para mudá-los, a pessoa muda o CEP
  const [travados, setTravados] = useState<CampoDoCep[]>([])
  const numeroRef = useRef<HTMLInputElement>(null)
  // O Perfil pode ter dois formulários de endereço na tela (principal e a janela de outro)
  const idNumero = useId()
  const buscaRef = useRef<AbortController | null>(null)

  // Ao abrir com um CEP já salvo, consulta de novo para travar os campos que conferem com ele.
  // Não altera nenhum valor, para o formulário não aparecer como "alterado".
  useEffect(() => {
    const cepInicial = endereco.cep
    if (cepInicial.length !== 9) return
    const controle = new AbortController()
    buscaRef.current = controle
    buscarCep(cepInicial, controle.signal)
      .then((dados) => {
        if (!dados) return
        setStatus('encontrado')
        setTravados(
          CAMPOS_DO_CEP.filter((c) => dados[c] && mesmoTexto(dados[c], endereco[c])),
        )
      })
      .catch(() => {
        // Sem conexão com a API: deixa tudo editável
      })
    return () => controle.abort()
    // Só na primeira renderização
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function aoAlterarCep(valor: string) {
    const cep = mascaraCep(valor)
    if (cep === endereco.cep) return

    // Mudou o CEP: o que veio do CEP anterior deixa de valer
    const limpar: Partial<Endereco> = {}
    for (const campo of travados) limpar[campo] = ''
    setTravados([])
    onAlterar({ cep, ...limpar })

    buscaRef.current?.abort()
    if (cep.length !== 9) {
      setStatus('ocioso')
      return
    }

    const controle = new AbortController()
    buscaRef.current = controle
    setStatus('buscando')
    try {
      const dados = await buscarCep(cep, controle.signal)
      if (!dados) {
        setStatus('nao-encontrado')
        return
      }
      setStatus('encontrado')
      // Só trava o que a API devolveu preenchido (CEPs de cidade pequena podem vir sem rua/bairro)
      const preenchidos = CAMPOS_DO_CEP.filter((c) => dados[c])
      const novos: Partial<Endereco> = {}
      for (const campo of preenchidos) novos[campo] = dados[campo]
      onAlterar(novos)
      setTravados(preenchidos)
      onCepEncontrado?.(dados)
      // Vai para o primeiro campo que a pessoa ainda precisa preencher
      if (preenchidos.includes('rua')) numeroRef.current?.focus()
    } catch (erro) {
      if ((erro as Error).name !== 'AbortError') setStatus('indisponivel')
    }
  }

  const estaTravado = (campo: keyof Endereco) => travados.includes(campo as CampoDoCep)

  const semNumero = endereco.numero === SEM_NUMERO

  // Todos são obrigatórios, exceto o complemento
  const campo = (
    nome: 'rua' | 'complemento' | 'bairro' | 'cidade',
    rotulo: string,
    classe: string,
    extras: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> } = {},
  ) => {
    const travado = estaTravado(nome)
    return (
      <label className={`campo ${classe}`}>
        <span className={`campo__rotulo ${nome !== 'complemento' ? 'campo__rotulo--obrigatorio' : ''}`}>
          {rotulo}
          {travado && <Lock size={11} className="campo__cadeado" aria-label="preenchido pelo CEP" />}
        </span>
        <input
          className={`input ${erros[nome] ? 'input--erro' : ''}`}
          value={endereco[nome]}
          maxLength={LIMITES[nome]}
          readOnly={travado}
          tabIndex={travado ? -1 : undefined}
          title={travado ? 'Preenchido pelo CEP. Para alterar, mude o CEP.' : undefined}
          onChange={(e) => onAlterar({ [nome]: e.target.value })}
          aria-required={nome !== 'complemento'}
          {...extras}
        />
        {erros[nome] && <span className="campo__erro">{erros[nome]}</span>}
      </label>
    )
  }

  const ufTravada = estaTravado('uf')

  return (
    <div className="endereco">
      <label className="campo endereco__cep">
        <span className="campo__rotulo campo__rotulo--obrigatorio">CEP</span>
        <span className="input-com-botao">
          <input
            className={`input ${erros.cep ? 'input--erro' : ''}`}
            aria-required
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={endereco.cep}
            onChange={(e) => aoAlterarCep(e.target.value)}
          />
          <span className="input-com-botao__botao" aria-hidden="true">
            {status === 'buscando' && <LoaderCircle size={16} className="girando" />}
            {status === 'encontrado' && <CircleCheck size={16} className="endereco__ok" />}
          </span>
        </span>
        {erros.cep ? (
          <span className="campo__erro">{erros.cep}</span>
        ) : status === 'nao-encontrado' ? (
          <span className="campo__erro">CEP não encontrado. Confira ou preencha o endereço abaixo.</span>
        ) : status === 'indisponivel' ? (
          <span className="campo__erro">Não foi possível consultar o CEP. Preencha manualmente.</span>
        ) : (
          <a className="campo__ajuda endereco__link" href={LINK_BUSCA_CEP} target="_blank" rel="noreferrer">
            Não sei meu CEP
          </a>
        )}
      </label>

      {travados.length > 0 && (
        <p className="campo__ajuda endereco__aviso">
          <Lock size={12} /> Campos com cadeado foram preenchidos pelo CEP. Para alterá-los, mude o
          CEP.
        </p>
      )}

      {campo('rua', 'Rua', 'endereco__rua', { autoComplete: 'address-line1', placeholder: 'Rua, avenida...' })}
      <div className="campo endereco__numero">
        <label className="campo__rotulo campo__rotulo--obrigatorio" htmlFor={idNumero}>
          Número
        </label>
        <input
          id={idNumero}
          ref={numeroRef}
          className={`input ${erros.numero ? 'input--erro' : ''}`}
          inputMode="numeric"
          placeholder={semNumero ? 'Sem número' : 'Nº'}
          aria-required={!semNumero}
          maxLength={LIMITES.numero}
          disabled={semNumero}
          value={semNumero ? '' : endereco.numero}
          onChange={(e) => onAlterar({ numero: filtrarNumero(e.target.value) })}
        />
        <label className="caixa">
          <input
            type="checkbox"
            checked={semNumero}
            onChange={(e) => {
              onAlterar({ numero: e.target.checked ? SEM_NUMERO : '' })
              if (!e.target.checked) setTimeout(() => numeroRef.current?.focus())
            }}
          />
          Sem número
        </label>
        {erros.numero && <span className="campo__erro">{erros.numero}</span>}
      </div>
      {!semComplemento &&
        campo('complemento', 'Complemento', 'endereco__complemento', {
          autoComplete: 'address-line2',
          placeholder: 'Apto, bloco, casa',
        })}
      {campo('bairro', 'Bairro', 'endereco__bairro')}
      {campo('cidade', 'Cidade', 'endereco__cidade', { autoComplete: 'address-level2' })}

      <label className="campo endereco__uf">
        <span className="campo__rotulo campo__rotulo--obrigatorio">
          UF
          {ufTravada && <Lock size={11} className="campo__cadeado" aria-label="preenchido pelo CEP" />}
        </span>
        {/* select não tem readOnly: quando travado, mostra um campo de texto somente leitura */}
        {ufTravada ? (
          <input
            className="input"
            value={endereco.uf}
            readOnly
            tabIndex={-1}
            title="Preenchido pelo CEP. Para alterar, mude o CEP."
          />
        ) : (
          <select
            className={`input ${erros.uf ? 'input--erro' : ''}`}
            aria-required
            autoComplete="address-level1"
            value={endereco.uf}
            onChange={(e) => onAlterar({ uf: e.target.value })}
          >
            <option value="">--</option>
            {ufs.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        )}
        {erros.uf && <span className="campo__erro">{erros.uf}</span>}
      </label>

      <Suspense
        fallback={
          <div className="campo campo--inteiro">
            <span className="campo__rotulo campo__rotulo--obrigatorio">Local no mapa</span>
            <div className="mapa-endereco__vazio">
              <LoaderCircle size={18} className="girando" aria-hidden="true" />
              <span>Carregando o mapa...</span>
            </div>
          </div>
        }
      >
        <MapaDoEndereco
          endereco={endereco}
          erro={erros.latitude}
          onAlterar={(coordenadas) => onAlterarPai(coordenadas)}
        />
      </Suspense>
    </div>
  )
}
