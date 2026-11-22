import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Check, LoaderCircle, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import JanelaEndereco from './JanelaEndereco'
import { useAuth } from '../context/useAuth'
import type { EnderecoSalvo, Usuario } from '../data/usuario'
import { mensagemDeErro } from '../services/api'
import { bairroECidade, ruaENumero, tituloDoEndereco } from '../utils/formatar'

/** "Coleta seletiva: Região X" ou aviso de que a coleta ainda não passa lá. */
export function RegiaoDoEndereco({ endereco }: { endereco: EnderecoSalvo }) {
  return endereco.regiao ? (
    <span className="endereco-salvo__regiao">
      <Check size={13} aria-hidden="true" /> Coleta seletiva: {endereco.regiao.nome}
    </span>
  ) : (
    <span className="endereco-salvo__regiao endereco-salvo__regiao--fora">
      <AlertCircle size={13} aria-hidden="true" /> A retirada ainda não atende este endereço.{' '}
      <Link to="/pontos">Ver pontos de coleta</Link>
    </span>
  )
}

type Janela = { editando: EnderecoSalvo | null } | null

// Card do Perfil com os endereços além do principal: cadastrar, editar,
// tornar principal e excluir (com confirmação na própria linha).
export default function OutrosEnderecos({ usuario }: { usuario: Usuario }) {
  const { tornarPrincipal, excluirEndereco } = useAuth()
  const [janela, setJanela] = useState<Janela>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const outros = usuario.enderecos.filter((e) => e.id !== usuario.enderecoId)

  async function executar(id: string, acao: () => Promise<void>, sucesso: string) {
    setOcupado(id)
    setErro('')
    setAviso('')
    try {
      await acao()
      setAviso(sucesso)
      setConfirmando(null)
    } catch (falha) {
      setErro(mensagemDeErro(falha, 'Não foi possível concluir agora. Tente de novo.'))
    } finally {
      setOcupado(null)
    }
  }

  return (
    <section className="card perfil__secao outros-enderecos" aria-labelledby="outros-enderecos-titulo">
      <div className="outros-enderecos__topo">
        <div>
          <h2 id="outros-enderecos-titulo" className="perfil__secao-titulo">
            Outros endereços
          </h2>
          <p className="texto-suave">
            Trabalho, loja ou outro local onde a retirada pode acontecer. Na hora do pedido, você
            escolhe qual usar.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--contorno btn--pequeno"
          onClick={() => {
            setAviso('')
            setJanela({ editando: null })
          }}
        >
          <Plus size={15} /> Adicionar endereço
        </button>
      </div>

      {aviso && (
        <p className="alerta alerta--sucesso" role="status">
          <Check size={16} aria-hidden="true" /> {aviso}
        </p>
      )}
      {erro && (
        <p className="alerta alerta--erro" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{erro}</span>
        </p>
      )}

      {outros.length === 0 ? (
        <p className="outros-enderecos__vazio texto-suave">Nenhum outro endereço cadastrado.</p>
      ) : (
        <ul className="outros-enderecos__lista">
          {outros.map((e) => {
            const nomeVisivel = tituloDoEndereco(e)
            const esteOcupado = ocupado === e.id
            return (
              <li key={e.id} className="endereco-salvo">
                <MapPin size={18} strokeWidth={1.75} className="endereco-salvo__icone" aria-hidden="true" />
                <div className="endereco-salvo__texto">
                  <strong>{nomeVisivel}</strong>
                  {e.nome.trim() && <span>{ruaENumero(e.endereco)}</span>}
                  <span>{bairroECidade(e.endereco)}</span>
                  <RegiaoDoEndereco endereco={e} />
                </div>

                {confirmando === e.id ? (
                  <div className="endereco-salvo__confirmar" role="group" aria-label={`Excluir ${nomeVisivel}`}>
                    <span>Excluir este endereço?</span>
                    <button
                      type="button"
                      className="btn btn--perigo btn--pequeno"
                      disabled={esteOcupado}
                      onClick={() =>
                        executar(e.id, () => excluirEndereco(e.id), `"${nomeVisivel}" foi excluído.`)
                      }
                    >
                      {esteOcupado ? <LoaderCircle size={14} className="girando" /> : <Trash2 size={14} />}{' '}
                      Excluir
                    </button>
                    <button
                      type="button"
                      className="btn btn--contorno btn--pequeno"
                      disabled={esteOcupado}
                      onClick={() => setConfirmando(null)}
                    >
                      Manter
                    </button>
                  </div>
                ) : (
                  <div className="endereco-salvo__acoes">
                    <button
                      type="button"
                      className="btn btn--texto btn--pequeno"
                      disabled={ocupado !== null}
                      aria-label={`Tornar ${nomeVisivel} o endereço principal`}
                      onClick={() =>
                        executar(
                          e.id,
                          () => tornarPrincipal(e.id),
                          `"${nomeVisivel}" agora é o endereço principal.`,
                        )
                      }
                    >
                      {esteOcupado ? <LoaderCircle size={14} className="girando" /> : <Star size={14} />}{' '}
                      Tornar principal
                    </button>
                    <button
                      type="button"
                      className="btn btn--texto btn--pequeno"
                      disabled={ocupado !== null}
                      aria-label={`Editar ${nomeVisivel}`}
                      onClick={() => {
                        setAviso('')
                        setJanela({ editando: e })
                      }}
                    >
                      <Pencil size={14} /> Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn--texto-perigo btn--pequeno"
                      disabled={ocupado !== null}
                      aria-label={`Excluir ${nomeVisivel}`}
                      onClick={() => {
                        setErro('')
                        setConfirmando(e.id)
                      }}
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {outros.length > 0 && (
        <p className="campo__ajuda">
          O endereço principal não pode ser excluído. Para trocar, torne outro endereço principal.
        </p>
      )}

      {janela && (
        <JanelaEndereco
          editando={janela.editando}
          aoFechar={() => setJanela(null)}
          aoSalvar={(salvo) =>
            setAviso(
              salvo.principal
                ? `"${tituloDoEndereco(salvo)}" foi salvo e agora é o endereço principal.`
                : `"${tituloDoEndereco(salvo)}" foi salvo.`,
            )
          }
        />
      )}
    </section>
  )
}
