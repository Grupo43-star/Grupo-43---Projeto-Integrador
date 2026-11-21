USE reciclabairro_db;

-- Utilizadores de teste
INSERT INTO usuarios (nome, email, senha_hash, telefone, endereco, bairro, tipo_perfil) VALUES
('Ana Silva', 'ana.silva@email.com', 'hash_senha_123', '11999991111', 'Rua das Flores, 120', 'Centro', 'morador'),
('Carlos Oliveira', 'carlos.coleta@email.com', 'hash_senha_456', '11988882222', 'Av. Brasil, 450', 'Jardim América', 'coletor'),
('Mariana Costa', 'admin@reciclabairro.com', 'hash_admin_789', '11977773333', 'Rua da Paz, 10', 'Centro', 'admin');

-- Materiais no Guia
INSERT INTO materiais (nome, categoria, instrucoes_descarte, pode_reciclar, pontos_por_kg) VALUES
('Garrafa PET', 'plastico', 'Lavar ligeiramente, retirar o rótulo se possível e amassar para reduzir volume.', TRUE, 15),
('Caixa de Papelão', 'papel', 'Desmontar e manter seca, sem restos de gordura ou comida.', TRUE, 10),
('Óleo de Cozinha Usado', 'oleo', 'Armazenar frio numa garrafa PET bem fechada e entregar num ecoponto.', TRUE, 25),
('Pilha e Bateria', 'eletronico', 'Não misturar com lixo comum; levar apenas a pontos de coleta especializados.', TRUE, 30);

-- Pontos de Coleta
INSERT INTO pontos_coleta (nome_local, endereco, bairro, horario_funcionamento, materiais_aceitos) VALUES
('Ecoponto Central', 'Praça da Matriz, s/n', 'Centro', 'Seg a Sáb, das 08h às 18h', 'Plástico, Papel, Vidro, Metal, Óleo'),
('Cooperativa Verde Vida', 'Rua Industrial, 890', 'Vila Nova', 'Seg a Sex, das 07h às 17h', 'Todos os recicláveis e Eletrónicos');

-- Calendário de Coleta
INSERT INTO calendario_coleta (bairro, dia_semana, horario_inicio, horario_fim, tipo_residuo) VALUES
('Centro', 'Segunda', '08:00:00', '12:00:00', 'Recicláveis Secos (Plástico, Papel, Metal)'),
('Jardim América', 'Quarta', '13:00:00', '17:00:00', 'Recicláveis Secos e Vidro');

-- Solicitação de Retirada e Itens
INSERT INTO solicitacoes_retirada (usuario_id, endereco_retirada, data_agendada, turno, status, observacoes) VALUES
(1, 'Rua das Flores, 120', '2026-11-25', 'manha', 'agendada', 'Tocar à campainha do portão azul.');

INSERT INTO itens_solicitacao (solicitacao_id, material_id, quantidade_estimada) VALUES
(1, 1, '3 kg'),
(1, 2, '5 kg');