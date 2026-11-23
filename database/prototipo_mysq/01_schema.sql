CREATE DATABASE IF NOT EXISTS reciclabairro_db
DEFAULT CHARACTER SET utf8mb4
DEFAULT COLLATE utf8mb4_unicode_ci;

USE reciclabairro_db;

-- 1. Usuários (#perfil)
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    endereco VARCHAR(200),
    bairro VARCHAR(80) NOT NULL,
    tipo_perfil ENUM('morador', 'coletor', 'admin') DEFAULT 'morador',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Guia de Materiais (#guia)
CREATE TABLE materiais (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(80) NOT NULL,
    categoria ENUM('plastico', 'papel', 'vidro', 'metal', 'eletronico', 'oleo', 'organico', 'outros') NOT NULL,
    instrucoes_descarte TEXT NOT NULL,
    pode_reciclar BOOLEAN DEFAULT TRUE,
    pontos_por_kg INT DEFAULT 10
);

-- 3. Pontos de Coleta (#pontos)
CREATE TABLE pontos_coleta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome_local VARCHAR(120) NOT NULL,
    endereco VARCHAR(200) NOT NULL,
    bairro VARCHAR(80) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    horario_funcionamento VARCHAR(100),
    materiais_aceitos VARCHAR(255) NOT NULL
);

-- 4. Calendário de Coleta (#calendario)
CREATE TABLE calendario_coleta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bairro VARCHAR(80) NOT NULL,
    dia_semana ENUM('Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo') NOT NULL,
    horario_inicio TIME NOT NULL,
    horario_fim TIME NOT NULL,
    tipo_residuo VARCHAR(100) NOT NULL
);

-- 5. Solicitações de Retirada (#solicitacoes)
CREATE TABLE solicitacoes_retirada (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    endereco_retirada VARCHAR(200) NOT NULL,
    data_agendada DATE NOT NULL,
    turno ENUM('manha', 'tarde', 'noite') NOT NULL,
    status ENUM('pendente', 'agendada', 'concluida', 'cancelada') DEFAULT 'pendente',
    observacoes TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- 6. Itens de cada Solicitação (relação N:N entre solicitação e material)
CREATE TABLE itens_solicitacao (
    id INT AUTO_INCREMENT PRIMARY KEY,
    solicitacao_id INT NOT NULL,
    material_id INT NOT NULL,
    quantidade_estimada VARCHAR(50) NOT NULL,
    FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes_retirada(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materiais(id) ON DELETE RESTRICT
);

-- 7. Comunidade e Transparência (#comunidade)
CREATE TABLE publicacoes_comunidade (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    conteudo TEXT NOT NULL,
    categoria ENUM('aviso', 'dica', 'transparencia', 'evento') DEFAULT 'dica',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- 8. Fale Conosco (#perfil / ajuda)
CREATE TABLE mensagens_contato (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL,
    assunto VARCHAR(150) NOT NULL,
    mensagem TEXT NOT NULL,
    respondido BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);