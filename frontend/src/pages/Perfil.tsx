import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  Check,
  LoaderCircle,
  LogOut,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react'
import CamposEndereco from '../components/CamposEndereco'
import ExcluirConta from '../components/ExcluirConta'
import OutrosEnderecos, { RegiaoDoEndereco } from '../components/OutrosEnderecos'
import { useAuth, type DadosPerfil } from '../context/useAuth'
import { useColetasConcluidas } from '../hooks/useColetasConcluidas'
import { nomesPapel, type Endereco, type Usuario } from '../data/usuario'
import { mensagemDeErro } from '../services/api'
import { bairroDoUsuario, dataDeIso, iniciais } from '../utils/formatar'
import { ehSolicitante } from '../utils/papeis'
import {
  LIMITES,
  MINIMOS,
  mascaraTelefone,
  telefoneValido,
  validarEndereco,
  type ErrosEndereco,
} from '../utils/validar'
import './perfil.css'

function Cabecalho({ descricao }: { descricao: string }) {
  return (
    <header className="perfil__cabecalho">
      <p className="eyebrow">Sua conta</p>
      <h1 className="perfil__titulo">
        Seu perfil,
        <br />
        seu bairro.
      </h1>
      <p className="texto-suave perfil__descricao">{descricao}</p>
    </header>
  )
}

export default function Perfil() {
  const { usuario } = useAuth()

  if (!usuario) {
    return (
      <div className="page">
        <Cabecalho descricao="Entre para atualizar seus dados e o endereço usado nas retiradas." />
        <div className="card card--row card--convite">
          <span className="icon-circle">
            <User size={20} strokeWidth={1.75} />
          </span>
          <div className="card--convite__texto">
            <h2 className="card__titulo">Entre para cuidar do seu perfil</h2>
            <p className="texto-suave">
              Seus dados e preferências ficam disponíveis depois que você entrar na sua conta.
            </p>
          </div>
          <Link to="/entrar" state={{ de: '/perfil' }} className="btn btn--primario">
            Entrar na minha conta <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    )
  }

  // `key` recria o formulário se a pessoa logada mudar
  return <PerfilLogado key={usuario.id} usuario={usuario} />
}

function PerfilLogado({ usuario }: { usuario: Usuario }) {
  const { atualizarPerfil, sair } = useAuth()
  const navigate = useNavigate()

  const inicial: DadosPerfil = {
    nome: usuario.nome,
    telefone: usuario.telefone,
    endereco: usuario.endereco,
    nomeEndereco: usuario.nomeEndereco,
  }
  const [form, setForm] = useState<DadosPerfil>(inicial)
  // Outro endereço virou o principal ("Tornar principal" ou na janela): o formulário passa a
  // mostrar o novo principal (mantém nome e telefone digitados) e os campos do endereço
  // recomeçam (key), para consultar o CEP de novo. Ajuste durante a renderização, sem efeito.
  const [idPrincipal, setIdPrincipal] = useState(usuario.enderecoId)
  const [versaoEndereco, setVersaoEndereco] = useState(0)
  if (usuario.enderecoId !== idPrincipal) {
    setIdPrincipal(usuario.enderecoId)
    if (idPrincipal !== null) {
      setForm((atual) => ({
        ...atual,
        endereco: usuario.endereco,
        nomeEndereco: usuario.nomeEndereco,
      }))
      setVersaoEndereco((v) => v + 1)
    }
  }
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erroNome, setErroNome] = useState('')
  const [erroTelefone, setErroTelefone] = useState('')
  const [erroGeral, setErroGeral] = useState('')
  // Contas de equipe não pedem retiradas: sem endereço no perfil e sem "coletas concluídas"
  // (GET /pickup-requests é só de morador/comerciante)
  const solicitante = ehSolicitante(usuario.papel)
  const coletas = useColetasConcluidas(solicitante ? usuario.id : null)
  const [errosEndereco, setErrosEndereco] = useState<ErrosEndereco>({})
  const [excluindo, setExcluindo] = useState(false)
  // DELETE /me é só para MORADOR e COMERCIANTE (equipe recebe STAFF_ACCOUNT)
  const podeExcluir = usuario.papel === 'MORADOR' || usuario.papel === 'COMERCIANTE'

  const salvoAgora: DadosPerfil = {
    nome: usuario.nome,
    telefone: usuario.telefone,
    endereco: usuario.endereco,
    nomeEndereco: usuario.nomeEndereco,
  }
  const alterado = JSON.stringify(form) !== JSON.stringify(salvoAgora)

  function alterar<K extends keyof DadosPerfil>(campo: K, valor: DadosPerfil[K]) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
    setSalvo(false)
    setErroGeral('')
  }

  function alterarEndereco(parcial: Partial<Endereco>) {
    setForm((atual) => ({ ...atual, endereco: { ...atual.endereco, ...parcial } }))
    // Some com o erro do campo assim que a pessoa mexe nele
    setErrosEndereco((atual) => {
      const novo = { ...atual }
      for (const campo of Object.keys(parcial)) delete novo[campo as keyof Endereco]
      return novo
    })
    setSalvo(false)
  }

  async function aoSalvar(evento: FormEvent) {
    evento.preventDefault()
    const erroNomeAtual = form.nome.trim().length < MINIMOS.nome ? 'Informe seu nome.' : ''
    // O back não aceita apagar o telefone depois de cadastrado
    const erroTelefoneAtual = form.telefone
      ? telefoneValido(form.telefone)
        ? ''
        : 'Informe o telefone com DDD.'
      : usuario.telefone
        ? 'Informe um telefone. Depois de cadastrado, ele não pode ficar em branco.'
        : ''
    const errosEnderecoAtuais = solicitante ? validarEndereco(form.endereco) : {}
    setErroNome(erroNomeAtual)
    setErroTelefone(erroTelefoneAtual)
    setErrosEndereco(errosEnderecoAtuais)
    if (erroNomeAtual || erroTelefoneAtual || Object.keys(errosEnderecoAtuais).length > 0) return

    // Só envia o que mudou: PATCH /me e/ou o endereço
    const nome = form.nome.trim()
    const mudouDados = nome !== usuario.nome || form.telefone !== usuario.telefone
    const nomeEndereco = form.nomeEndereco.trim()
    const mudouEndereco =
      JSON.stringify(form.endereco) !== JSON.stringify(usuario.endereco) ||
      nomeEndereco !== usuario.nomeEndereco

    setSalvando(true)
    setErroGeral('')
    try {
      await atualizarPerfil({
        ...(mudouDados ? { nome, telefone: form.telefone } : {}),
        ...(mudouEndereco ? { endereco: form.endereco, nomeEndereco } : {}),
      })
      setForm((atual) => ({ ...atual, nome, nomeEndereco }))
      setSalvo(true)
    } catch (erro) {
      setErroGeral(mensagemDeErro(erro, 'Não foi possível salvar. Tente de novo.'))
    } finally {
      setSalvando(false)
    }
  }

  async function aoSair() {
    await sair()
    navigate('/')
  }

  const bairro = bairroDoUsuario(usuario)
  const principal = usuario.enderecos.find((e) => e.id === usuario.enderecoId) ?? null
  const membroDesde = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    dataDeIso(usuario.membroDesde),
  )

  return (
    <div className="page">
      <Cabecalho
        descricao={
          solicitante
            ? 'Atualize seus dados e o endereço usado nas retiradas.'
            : 'Atualize seus dados de contato. A equipe usa o telefone para combinar as coletas.'
        }
      />

      {solicitante && !bairro && (
        <p className="alerta alerta--sucesso perfil__boas-vindas">
          <Sparkles size={16} />
          Boas-vindas! Cadastre seu endereço para ver agendas e pontos de coleta perto de você.
        </p>
      )}

      <div className="perfil__grid">
        <div className="perfil__coluna">
        <form className="perfil__form" onSubmit={aoSalvar} noValidate>
          <section className="card perfil__secao">
            <h2 className="perfil__secao-titulo">Dados pessoais</h2>
            <div className="perfil__campos">
              <label className="campo campo--inteiro">
                <span className="campo__rotulo campo__rotulo--obrigatorio">Nome completo</span>
                <input
                  className={`input ${erroNome ? 'input--erro' : ''}`}
                  aria-required
                  maxLength={LIMITES.nome}
                  value={form.nome}
                  autoComplete="name"
                  onChange={(e) => alterar('nome', e.target.value)}
                />
                {erroNome && <span className="campo__erro">{erroNome}</span>}
              </label>
              <label className="campo">
                <span className="campo__rotulo">E-mail</span>
                <input className="input" value={usuario.email} disabled />
                <span className="campo__ajuda">O e-mail de acesso não pode ser alterado.</span>
              </label>
              <label className="campo">
                <span className="campo__rotulo">Telefone</span>
                <input
                  className={`input ${erroTelefone ? 'input--erro' : ''}`}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(00) 00000-0000"
                  value={form.telefone}
                  onChange={(e) => alterar('telefone', mascaraTelefone(e.target.value))}
                />
                {erroTelefone && <span className="campo__erro">{erroTelefone}</span>}
              </label>
            </div>
          </section>

          {solicitante && (
          <section className="card perfil__secao">
            <h2 className="perfil__secao-titulo">
              {usuario.enderecos.length > 1 ? 'Endereço principal' : 'Endereço'}
            </h2>
            <p className="texto-suave">
              Usado nas retiradas e para mostrar agendas e pontos de coleta do seu bairro. Digite
              o CEP para preencher o restante automaticamente.
            </p>
            {principal && <RegiaoDoEndereco endereco={principal} />}
            <label className="campo perfil__nome-endereco">
              <span className="campo__rotulo">Nome do endereço</span>
              <input
                className="input"
                maxLength={LIMITES.nomeEndereco}
                placeholder="Ex.: Casa"
                value={form.nomeEndereco}
                onChange={(e) => alterar('nomeEndereco', e.target.value)}
              />
              <span className="campo__ajuda">Opcional. Ajuda a escolher o endereço no pedido.</span>
            </label>
            <CamposEndereco
              key={versaoEndereco}
              endereco={form.endereco}
              erros={errosEndereco}
              onAlterar={alterarEndereco}
            />
          </section>
          )}

          {erroGeral && (
            <p className="alerta alerta--erro" role="alert">
              {erroGeral}
            </p>
          )}

          <div className="perfil__acoes">
            <p className="legenda-obrigatorio perfil__legenda">
              <span>*</span> Campos obrigatórios
            </p>
            {salvo && !alterado && (
              <span className="perfil__salvo">
                <Check size={16} /> Alterações salvas
              </span>
            )}
            <button className="btn btn--primario" disabled={!alterado || salvando}>
              {salvando ? (
                <>
                  <LoaderCircle size={16} className="girando" /> Salvando...
                </>
              ) : (
                'Salvar alterações'
              )}
            </button>
          </div>
        </form>

        {/* Só depois do 1º endereço: até lá, o formulário acima cadastra o principal */}
        {solicitante && usuario.enderecoId && <OutrosEnderecos usuario={usuario} />}
        </div>

        <aside className="perfil__lateral">
          <div className="card perfil__identidade">
            <span className="perfil__avatar">{iniciais(usuario.nome)}</span>
            <div>
              <h2 className="card__titulo">{usuario.nome}</h2>
              <p className="texto-suave">{usuario.email}</p>
            </div>
            {solicitante ? (
              <p className="perfil__meta">
                <MapPin size={14} />{' '}
                {bairro ? `${bairro}, ${usuario.endereco.cidade}` : 'Endereço não informado'}
              </p>
            ) : (
              usuario.cooperativa && (
                <p className="perfil__meta">
                  <Building2 size={14} /> {usuario.cooperativa.nome}
                </p>
              )
            )}
            <p className="perfil__meta">
              Conta de {nomesPapel[usuario.papel].toLowerCase()} · Membro desde {membroDesde}
            </p>

            {coletas !== null && (
              <div className="perfil__numeros">
                <div>
                  <strong>{coletas}</strong>
                  <span>{coletas === 1 ? 'coleta concluída' : 'coletas concluídas'}</span>
                </div>
              </div>
            )}
          </div>

          <div className="card card--verde perfil__privacidade">
            <p className="eyebrow eyebrow--simples eyebrow--icone">
              <span className="icon-circle icon-circle--sm">
                <ShieldCheck size={13} />
              </span>
              Seus dados
            </p>
            <p className="texto-suave">
              Telefone e endereço só são usados para combinar retiradas. Eles nunca aparecem
              para outras pessoas.
            </p>
          </div>

          <button type="button" className="btn btn--contorno btn--largo" onClick={aoSair}>
            <LogOut size={16} /> Sair da conta
          </button>

          {podeExcluir ? (
            <button
              type="button"
              className="btn btn--texto-perigo perfil__excluir"
              onClick={() => setExcluindo(true)}
            >
              <Trash2 size={15} /> Excluir minha conta
            </button>
          ) : (
            <p className="texto-suave perfil__excluir-equipe">
              Contas de equipe são removidas pelo administrador ou pela gestão da cooperativa.
            </p>
          )}
        </aside>
      </div>

      {excluindo && <ExcluirConta aoFechar={() => setExcluindo(false)} />}
    </div>
  )
}
