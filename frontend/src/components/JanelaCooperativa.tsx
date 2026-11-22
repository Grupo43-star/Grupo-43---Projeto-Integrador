import { useState } from 'react'
import Janela from './Janela'
import { useConsulta } from '../hooks/useConsulta'
import {
  LIMITE_NOME_COOPERATIVA,
  listarRegioesAdmin,
  salvarCooperativa,
  type CooperativaAdmin,
} from '../services/admin'
import { mensagemDeErro } from '../services/api'
import { emailValido, mascaraTelefone, telefoneValido } from '../utils/validar'

/** Formata enquanto digita: 00.000.000/0000-00 */
function mascaraCnpj(valor: string) {
  const d = valor.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

type Erros = Partial<Record<'nome' | 'cnpj' | 'telefone' | 'email', string>>

// Cadastrar ou editar uma cooperativa (POST/PATCH /admin/cooperatives), só admin.
export default function JanelaCooperativa({
  original,
  aoFechar,
  aoSalvar,
}: {
  original: CooperativaAdmin | null
  aoFechar: () => void
  aoSalvar: (c: CooperativaAdmin) => void
}) {
  const regioes = useConsulta('regioes-admin', (s) => listarRegioesAdmin(s))
  const [nome, setNome] = useState(original?.nome ?? '')
  const [cnpj, setCnpj] = useState(original?.cnpj ? mascaraCnpj(original.cnpj) : '')
  const [telefone, setTelefone] = useState(original?.telefone ? mascaraTelefone(original.telefone) : '')
  const [email, setEmail] = useState(original?.email ?? '')
  const [regiaoIds, setRegiaoIds] = useState<string[]>(original?.regioes.map((r) => r.id) ?? [])
  const [ativa, setAtiva] = useState(original?.ativa ?? true)
  const [erros, setErros] = useState<Erros>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function confirmar() {
    const novos: Erros = {}
    if (nome.trim().length < 2) novos.nome = 'Informe o nome da cooperativa.'
    if (cnpj && cnpj.replace(/\D/g, '').length !== 14) novos.cnpj = 'Informe o CNPJ com 14 dígitos.'
    if (telefone && !telefoneValido(telefone)) novos.telefone = 'Informe o telefone com DDD.'
    if (email.trim() && !emailValido(email)) novos.email = 'Informe um e-mail válido.'
    setErros(novos)
    if (Object.keys(novos).length > 0) return
    setSalvando(true)
    setErro('')
    try {
      aoSalvar(await salvarCooperativa({ nome, cnpj, telefone, email, regiaoIds, ativa }, original?.id ?? null))
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível salvar agora. Tente de novo.'))
      setSalvando(false)
    }
  }

  return (
    <Janela
      titulo={original ? 'Editar cooperativa' : 'Nova cooperativa'}
      larga
      salvando={salvando}
      erro={erro}
      rotuloConfirmar={original ? 'Salvar' : 'Cadastrar cooperativa'}
      obrigatorios
      aoConfirmar={confirmar}
      aoFechar={aoFechar}
    >
      <div className="janela__campos">
        <label className="campo campo--inteiro">
          <span className="campo__rotulo campo__rotulo--obrigatorio">Nome</span>
          <input
            className={`input ${erros.nome ? 'input--erro' : ''}`}
            maxLength={LIMITE_NOME_COOPERATIVA}
            aria-required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          {erros.nome && <span className="campo__erro">{erros.nome}</span>}
        </label>
        <label className="campo">
          <span className="campo__rotulo">CNPJ</span>
          <input
            className={`input ${erros.cnpj ? 'input--erro' : ''}`}
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(e) => setCnpj(mascaraCnpj(e.target.value))}
          />
          {erros.cnpj && <span className="campo__erro">{erros.cnpj}</span>}
        </label>
        <label className="campo">
          <span className="campo__rotulo">Telefone</span>
          <input
            className={`input ${erros.telefone ? 'input--erro' : ''}`}
            inputMode="tel"
            placeholder="(00) 0000-0000"
            value={telefone}
            onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
          />
          {erros.telefone && <span className="campo__erro">{erros.telefone}</span>}
        </label>
        <label className="campo campo--inteiro">
          <span className="campo__rotulo">E-mail</span>
          <input
            type="email"
            className={`input ${erros.email ? 'input--erro' : ''}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {erros.email && <span className="campo__erro">{erros.email}</span>}
        </label>
      </div>

      <fieldset className="grupo-opcoes">
        <legend className="campo__rotulo">Regiões atendidas</legend>
        {regioes.erro ? (
          <span className="campo__erro">As regiões não puderam ser carregadas. {mensagemDeErro(regioes.erro)}</span>
        ) : !regioes.dados ? (
          <span className="texto-suave">Carregando...</span>
        ) : regioes.dados.length === 0 ? (
          <span className="texto-suave">Nenhuma região cadastrada.</span>
        ) : (
          <div className="lista-checks">
            {regioes.dados.map((r) => (
              <label key={r.id} className="caixa">
                <input
                  type="checkbox"
                  checked={regiaoIds.includes(r.id)}
                  onChange={(e) =>
                    setRegiaoIds((atual) => (e.target.checked ? [...atual, r.id] : atual.filter((x) => x !== r.id)))
                  }
                />
                <span>
                  {r.nome} ({r.cidade}/{r.uf}){r.ativa ? '' : ' - inativa'}
                </span>
              </label>
            ))}
          </div>
        )}
        <span className="campo__ajuda">Os pedidos novos dessas regiões aparecem na fila da cooperativa.</span>
      </fieldset>

      <label className="caixa">
        <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
        <span>Ativa (sem cooperativa ativa, a região não recebe pedidos de retirada)</span>
      </label>
    </Janela>
  )
}
