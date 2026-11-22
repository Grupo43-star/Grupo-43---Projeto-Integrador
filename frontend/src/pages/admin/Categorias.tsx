import { useState } from 'react'
import { Check, Pencil, Plus, Tags } from 'lucide-react'
import Janela from '../../components/Janela'
import PageHeader from '../../components/PageHeader'
import { Carregando, ErroComTentar } from '../../components/Painel'
import { useConsulta } from '../../hooks/useConsulta'
import {
  LIMITES_CATEGORIA,
  listarCategoriasAdmin,
  salvarCategoria,
  type CategoriaAdmin,
  type DadosCategoria,
} from '../../services/admin'
import { mensagemDeErro } from '../../services/api'
import { lerHex, propsCategoria } from '../../utils/corCategoria'
import '../equipe/equipe.css'

// Categorias do guia (POST/PATCH /admin/material-categories): admin e educador.
// O back não exclui categorias (materiais, pontos e pedidos dependem delas).
export default function Categorias() {
  const categorias = useConsulta('categorias-admin', (s) => listarCategoriasAdmin(s))
  const [editando, setEditando] = useState<CategoriaAdmin | 'nova' | null>(null)
  const [aviso, setAviso] = useState('')

  return (
    <div className="page page--larga">
      <PageHeader
        eyebrow="Guia de materiais"
        titulo="Categorias"
        descricao="Os grupos do guia (papel, plástico, vidro...). A cor aparece nos selos do guia, dos pontos e dos pedidos."
        icon={Tags}
      />

      <div className="painel__barra">
        <p className="texto-suave">
          {categorias.dados ? `${categorias.dados.length} categorias` : ''}
        </p>
        <button type="button" className="btn btn--primario" onClick={() => setEditando('nova')}>
          <Plus size={16} /> Nova categoria
        </button>
      </div>

      {aviso && (
        <p className="alerta alerta--sucesso painel__erro" role="status">
          <Check size={16} aria-hidden="true" /> {aviso}
        </p>
      )}

      {categorias.erro ? (
        <ErroComTentar erro={categorias.erro} titulo="Não foi possível carregar as categorias agora." aoTentar={categorias.recarregar} />
      ) : !categorias.dados ? (
        <Carregando />
      ) : (
        <ul className="painel__lista painel__lista--3">
          {categorias.dados.map((c) => (
            <li key={c.id} className="card categoria-admin">
              <span {...propsCategoria(c, 'tag')}>{c.nome}</span>
              <p className="texto-suave">{c.descricao || 'Sem descrição.'}</p>
              <dl className="categoria-admin__dados">
                <div>
                  <dt>Slug</dt>
                  <dd>{c.slug}</dd>
                </div>
                <div>
                  <dt>Cor</dt>
                  <dd>{c.cor || '-'}</dd>
                </div>
                <div>
                  <dt>Ícone</dt>
                  <dd>{c.icone || '-'}</dd>
                </div>
              </dl>
              <button type="button" className="btn btn--contorno btn--pequeno" onClick={() => setEditando(c)}>
                <Pencil size={14} /> Editar
              </button>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <JanelaCategoria
          original={editando === 'nova' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={(nome) => {
            setAviso(editando === 'nova' ? `Categoria ${nome} criada.` : `Categoria ${nome} atualizada.`)
            setEditando(null)
            categorias.recarregar()
          }}
        />
      )}
    </div>
  )
}

function JanelaCategoria({
  original,
  aoFechar,
  aoSalvar,
}: {
  original: CategoriaAdmin | null
  aoFechar: () => void
  aoSalvar: (nome: string) => void
}) {
  const [dados, setDados] = useState<DadosCategoria>({
    nome: original?.nome ?? '',
    cor: original?.cor ?? '',
    icone: original?.icone ?? '',
    descricao: original?.descricao ?? '',
  })
  const [erroNome, setErroNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const hex = lerHex(dados.cor)

  async function confirmar() {
    if (dados.nome.trim().length < 2) {
      setErroNome('Informe o nome (2 caracteres ou mais).')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      const salva = await salvarCategoria(dados, original?.id ?? null)
      aoSalvar(salva.nome)
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível salvar agora. Tente de novo.'))
      setSalvando(false)
    }
  }

  // Prévia com a slug que o back vai gerar não é possível sem o back; usa a atual (ou nenhuma)
  const previa = { slug: original && dados.nome.trim() === original.nome ? original.slug : '', cor: dados.cor.trim() || null }

  return (
    <Janela
      titulo={original ? 'Editar categoria' : 'Nova categoria'}
      salvando={salvando}
      erro={erro}
      rotuloConfirmar={original ? 'Salvar' : 'Criar categoria'}
      obrigatorios
      aoConfirmar={confirmar}
      aoFechar={aoFechar}
    >
      <div className="janela__campos">
        <label className="campo campo--inteiro">
          <span className="campo__rotulo campo__rotulo--obrigatorio">Nome</span>
          <input
            className={`input ${erroNome ? 'input--erro' : ''}`}
            maxLength={LIMITES_CATEGORIA.nome}
            aria-required
            value={dados.nome}
            onChange={(e) => {
              setDados((d) => ({ ...d, nome: e.target.value }))
              setErroNome('')
            }}
          />
          {erroNome ? (
            <span className="campo__erro">{erroNome}</span>
          ) : (
            original && (
              <span className="campo__ajuda">
                Mudar o nome muda também a slug ({original.slug}), usada nos links do guia.
              </span>
            )
          )}
        </label>
        <div className="campo">
          <label className="campo__rotulo" htmlFor="cor-categoria">
            Cor
          </label>
          <span className="cor-campo">
            <input
              type="color"
              aria-label="Escolher a cor"
              value={hex ? `#${hex.map((n) => n.toString(16).padStart(2, '0')).join('')}` : '#888888'}
              onChange={(e) => setDados((d) => ({ ...d, cor: e.target.value }))}
            />
            <input
              id="cor-categoria"
              className="input"
              maxLength={LIMITES_CATEGORIA.cor}
              placeholder="#2b6cb0"
              value={dados.cor}
              onChange={(e) => setDados((d) => ({ ...d, cor: e.target.value }))}
            />
          </span>
          <span className="campo__ajuda">
            Em hexadecimal. Categorias novas usam esta cor nos selos (com contraste ajustado).
          </span>
        </div>
        <label className="campo">
          <span className="campo__rotulo">Ícone</span>
          <input
            className="input"
            maxLength={LIMITES_CATEGORIA.icone}
            placeholder="Ex.: recycle"
            value={dados.icone}
            onChange={(e) => setDados((d) => ({ ...d, icone: e.target.value }))}
          />
          <span className="campo__ajuda">Nome do ícone usado pelo aplicativo.</span>
        </label>
        <label className="campo campo--inteiro">
          <span className="campo__rotulo">Descrição</span>
          <textarea
            className="input janela__texto"
            maxLength={LIMITES_CATEGORIA.descricao}
            placeholder="Ex.: Lixeira azul. Jornais, revistas, caixas."
            value={dados.descricao}
            onChange={(e) => setDados((d) => ({ ...d, descricao: e.target.value }))}
          />
        </label>
        <div className="campo campo--inteiro">
          <span className="campo__rotulo">Prévia</span>
          <span>
            <span {...propsCategoria(previa, 'tag')}>{dados.nome.trim() || 'Nome da categoria'}</span>
          </span>
        </div>
      </div>
    </Janela>
  )
}
