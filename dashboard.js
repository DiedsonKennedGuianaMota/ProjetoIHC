// dashboard.js
document.addEventListener('DOMContentLoaded', () => {
    const BiBankApp = {
        conta: null,
        usuarios: [],
        pendingTransactionCallback: null,

        init() {
            this.usuarios = JSON.parse(localStorage.getItem('biBankUsers')) || [];
            const loggedInUserCPF = sessionStorage.getItem('loggedInUserCPF');
            if (!loggedInUserCPF) { window.location.href = 'login.html'; return; }
            this.conta = this.usuarios.find(u => u.cpf === loggedInUserCPF);
            if (!this.conta) { window.location.href = 'login.html'; return; }

            // Garante que a estrutura de dados seja sempre consistente
            this.conta.saldos = this.conta.saldos || { corrente: 1000, poupanca: 500 };
            this.conta.saldoVisivel = this.conta.saldoVisivel !== undefined ? this.conta.saldoVisivel : true;
            this.conta.extrato = this.conta.extrato || [];
            this.conta.pixAgendados = this.conta.pixAgendados || [];
            this.conta.saldoInvestimento = this.conta.saldoInvestimento || 0;
            this.conta.emprestimoAtivo = this.conta.emprestimoAtivo || false;
            this.conta.cartaoFaturaAtual = this.conta.cartaoFaturaAtual || 0;
            this.conta.cartaoLimiteTotal = this.conta.cartaoLimiteTotal || 2500;
            this.conta.cartoes = this.conta.cartoes || [{ numero: `**** **** **** ${Math.floor(1000 + Math.random() * 9000)}`, tipo: 'Físico', ativo: true }];

            this.setupEventListeners();
            this.mostrarTela('menu');
        },

        salvarDados() {
            const userIndex = this.usuarios.findIndex(u => u.cpf === this.conta.cpf);
            if (userIndex !== -1) { this.usuarios[userIndex] = this.conta; localStorage.setItem('biBankUsers', JSON.stringify(this.usuarios)); }
        },

        mostrarTela(id) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            const tela = document.getElementById(id);
            if (tela) {
                tela.classList.add('active');
                const populadores = {
                    menu: () => this.popularTelaMenu(),
                    perfil: () => this.popularTelaPerfil(),
                    extrato: () => this.popularTelaExtrato(),
                    cartao: () => this.popularTelaCartao(),
                    investimento: () => this.popularTelaInvestimento(),
                    emprestimo: () => this.popularTelaEmprestimo(),
                };
                if (populadores[id]) populadores[id]();
            }
        },

        exibirPopup(tipo, titulo, mensagem) {
            const popup = document.getElementById('popup');
            popup.querySelector('#popupIcon').textContent = tipo === 'sucesso' ? '✔️' : '❌';
            popup.querySelector('#popupTitulo').textContent = titulo;
            popup.querySelector('#popupMensagem').textContent = mensagem;
            document.getElementById('overlay').style.display = 'block';
            popup.style.display = 'block';
        },

        fecharDialogo() {
            document.getElementById('overlay').style.display = 'none';
            document.querySelectorAll('.popup').forEach(p => p.style.display = 'none');
        },

        requestPasswordConfirmation(callback) {
            this.pendingTransactionCallback = callback;
            const popup = document.getElementById('passwordConfirmPopup');
            document.getElementById('confirmPassInput').value = '';
            document.getElementById('overlay').style.display = 'block';
            popup.style.display = 'block';
        },

        adicionarAoExtrato(tipo, descricao, valor, categoria = 'geral') {
            this.conta.extrato.push({ tipo, descricao, valor, data: new Date().toISOString(), categoria });
            this.salvarDados();
        },

        toggleSaldo() {
            this.conta.saldoVisivel = !this.conta.saldoVisivel;
            this.salvarDados();
            this.popularTelaMenu();
        },

        formatarMoeda: (valor) => (valor !== undefined && valor !== null) ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00',

        // --- FUNÇÕES DE POPULAR TELAS ---
        popularTelaMenu() {
            document.getElementById('nome-conta').textContent = `Olá, ${this.conta.nome.split(' ')[0]}`;
            document.getElementById('saldo-corrente').textContent = this.conta.saldoVisivel ? this.formatarMoeda(this.conta.saldos.corrente) : 'R$ ••••';
            document.getElementById('saldo-poupanca').textContent = this.conta.saldoVisivel ? this.formatarMoeda(this.conta.saldos.poupanca) : 'R$ ••••';
            const eyeIconContainer = document.querySelector('.eye-icon');
            if (eyeIconContainer) eyeIconContainer.classList.toggle('is-hidden', !this.conta.saldoVisivel);
        },

        popularTelaPerfil() {
            const tela = document.getElementById('perfil');
            tela.innerHTML = `<h2>Seu Perfil</h2><div class="content-block"><h4>Dados Pessoais</h4><p><strong>Nome Completo:</strong> ${this.conta.nome}</p><p><strong>CPF:</strong> ${this.conta.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</p></div><div class="content-block"><h4>Dados da Conta</h4><p><strong>Agência:</strong> 0001</p><p><strong>Conta:</strong> ${this.conta.cpf.slice(-5)}</p></div><button data-screen="menu" class="primary">Voltar ao Painel</button>`;
            this.setupScreenNavigators(tela);
        },

        popularTelaExtrato() {
            const tela = document.getElementById('extrato');
            tela.innerHTML = `<h2>Extrato da Conta</h2>
                <div class="extrato-filtros">
                    <input type="date" id="filtro-data-inicio" title="Data de Início">
                    <input type="date" id="filtro-data-fim" title="Data de Fim">
                    <select id="filtro-tipo"><option value="todos">Todas</option><option value="credito">Entradas</option><option value="debito">Saídas</option></select>
                    <select id="filtro-categoria"><option value="todas">Categorias</option><option value="pix">PIX</option><option value="transferencia">Transferência</option><option value="investimento">Investimento</option><option value="emprestimo">Empréstimo</option><option value="cartao">Cartão</option><option value="saque">Saque</option></select>
                    <button id="btn-filtrar" class="primary" style="padding: 10px 15px;">Filtrar</button>
                    <button id="btn-imprimir-extrato" style="padding: 10px 15px;">Imprimir</button>
                </div>
                <div class="extrato-lista-container"><ul></ul></div>
                <button data-screen="menu" class="primary">Voltar ao Painel</button>`;

            const renderizarLista = () => {
                const dataInicio = document.getElementById('filtro-data-inicio').value ? new Date(document.getElementById('filtro-data-inicio').value + "T00:00:00") : null;
                const dataFim = document.getElementById('filtro-data-fim').value ? new Date(document.getElementById('filtro-data-fim').value + "T23:59:59") : null;
                const tipo = document.getElementById('filtro-tipo').value;
                const categoria = document.getElementById('filtro-categoria').value;

                let transacoesFiltradas = this.conta.extrato.filter(item => {
                    const itemData = new Date(item.data);
                    const eDepoisInicio = !dataInicio || itemData >= dataInicio;
                    const eAntesFim = !dataFim || itemData <= dataFim;
                    const eTipoCerto = tipo === 'todos' || item.tipo === tipo;
                    const eCategoriaCerta = categoria === 'todas' || item.categoria === categoria;
                    return eDepoisInicio && eAntesFim && eTipoCerto && eCategoriaCerta;
                });

                const listaUl = tela.querySelector('ul');
                listaUl.innerHTML = "";
                if (transacoesFiltradas.length === 0) { listaUl.innerHTML = "<li class='extrato-vazio'>Nenhuma transação encontrada.</li>"; return; }
                transacoesFiltradas.slice().reverse().forEach(item => {
                    const tipoClasse = item.tipo === 'debito' ? 'extrato-debito' : 'extrato-credito';
                    const sinal = item.tipo === 'debito' ? '-' : '+';
                    listaUl.innerHTML += `<li><div class="extrato-data">${new Date(item.data).toLocaleString('pt-BR')}</div><div class="extrato-desc">${item.descricao}</div><div class="extrato-valor ${tipoClasse}">${sinal} ${this.formatarMoeda(item.valor)}</div></li>`;
                });
            };

            renderizarLista();
            tela.querySelector('#btn-filtrar').addEventListener('click', renderizarLista);
            tela.querySelector('#btn-imprimir-extrato').addEventListener('click', () => {
                const printable = tela.querySelector('.extrato-lista-container').cloneNode(true);
                printable.classList.add('printable');
                document.body.appendChild(printable);
                window.print();
                document.body.removeChild(printable);
            });
            this.setupScreenNavigators(tela);
        },

        popularTelaCartao() {
            const tela = document.getElementById('cartao');
            const fatura = this.conta.cartaoFaturaAtual;
            const limite = this.conta.cartaoLimiteTotal;
            const disponivel = limite - fatura;
            let cartoesHtml = '<h4>Seus Cartões</h4>';
            this.conta.cartoes.forEach(cartao => {
                cartoesHtml += `<div class="cartao-item"><span>${cartao.numero} (${cartao.tipo})</span><strong>${cartao.ativo ? 'Ativo' : 'Inativo'}</strong></div>`;
            });
            tela.innerHTML = `<h2>Cartão de Crédito</h2>
                <div class="content-block">${cartoesHtml}</div>
                <div class="content-block"><h4>Resumo da Fatura</h4><p>Limite Total: <strong>${this.formatarMoeda(limite)}</strong></p><p>Fatura Atual: <strong style="color:var(--erro);">${this.formatarMoeda(fatura)}</strong></p><p>Limite Disponível: <strong>${this.formatarMoeda(disponivel)}</strong></p></div>
                <div class="menu-grid" style="grid-template-columns: 1fr 1fr; gap: 15px;"><button id="btn-novo-cartao-virtual">Criar Cartão Virtual</button><button id="btn-pagar-fatura" class="primary" ${fatura <= 0 ? 'disabled' : ''}>Pagar Fatura</button></div>
                <button data-screen="menu">Voltar ao Painel</button>`;
            this.setupScreenNavigators(tela);
            tela.querySelector('#btn-pagar-fatura')?.addEventListener('click', () => this.requestPasswordConfirmation(() => this.executarPagamentoFatura()));
            tela.querySelector('#btn-novo-cartao-virtual')?.addEventListener('click', () => this.criarCartaoVirtual());
        },

        popularTelaInvestimento() {
            const tela = document.getElementById('investimento');
            tela.innerHTML = `<h2>Investimentos</h2>
                <div class="content-block"><h4>Seu Saldo de Investimentos</h4><p style="text-align:center; font-size: 1.5em;"><strong>${this.formatarMoeda(this.conta.saldoInvestimento)}</strong></p></div>
                <div class="content-block"><h4>Ações</h4><input type="number" id="valor-investimento" placeholder="Valor (R$)"><div class="menu-grid" style="grid-template-columns: 1fr 1fr; gap: 15px;"><button id="btn-aplicar" class="primary">Aplicar</button><button id="btn-resgatar">Resgatar</button></div></div>
                <button data-screen="menu">Voltar</button>`;
            this.setupScreenNavigators(tela);
            tela.querySelector('#btn-aplicar').addEventListener('click', () => this.requestPasswordConfirmation(() => this.executarInvestimento('aplicar')));
            tela.querySelector('#btn-resgatar').addEventListener('click', () => this.requestPasswordConfirmation(() => this.executarInvestimento('resgatar')));
        },

        popularTelaEmprestimo() {
            const tela = document.getElementById('emprestimo');
            let conteudo = '<h2>Empréstimos</h2>';
            if (this.conta.emprestimoAtivo) {
                conteudo += `<div class="content-block"><h4>Empréstimo Ativo</h4><p>Você possui uma fatura pendente no valor de <strong>${this.formatarMoeda(this.conta.faturaEmprestimo)}</strong>.</p></div>
                             <button id="btn-pagar-emprestimo" class="primary">Pagar Empréstimo</button>`;
            } else {
                conteudo += `<div class="content-block"><h4>Solicitar Novo Empréstimo</h4><p>Juros de 3% sobre o valor solicitado.</p><input type="number" id="valor-emprestimo" placeholder="Valor desejado (R$)"></div>
                             <button id="btn-solicitar-emprestimo" class="primary">Solicitar Empréstimo</button>`;
            }
            tela.innerHTML = conteudo + '<button data-screen="menu">Voltar</button>';
            this.setupScreenNavigators(tela);
            tela.querySelector('#btn-pagar-emprestimo')?.addEventListener('click', () => this.requestPasswordConfirmation(() => this.executarPagamentoEmprestimo()));
            tela.querySelector('#btn-solicitar-emprestimo')?.addEventListener('click', () => this.requestPasswordConfirmation(() => this.executarSolicitacaoEmprestimo()));
        },

        // --- LÓGICA DAS FUNCIONALIDADES ---
        executarSaque(contaOrigem, valor) {
            if (!valor || valor <= 0 || valor > this.conta.saldos[contaOrigem]) { this.exibirPopup('erro', 'Erro', 'Valor inválido ou saldo insuficiente.'); return; }
            this.conta.saldos[contaOrigem] -= valor;
            this.adicionarAoExtrato('debito', 'Saque em ATM', valor, 'saque');
            this.salvarDados(); this.popularTelaMenu();
            const codigo = Math.floor(100000 + Math.random() * 900000);
            this.renderizarModal(`<h3>Saque Aprovado</h3><p>Use o código abaixo em um caixa eletrônico BiBank para retirar ${this.formatarMoeda(valor)}.</p><h2 style="letter-spacing: 5px; margin: 20px 0;">${codigo}</h2>`);
        },

        executarDeposito(origem, destino, valor) {
            if (origem === destino) { this.exibirPopup('erro', 'Erro', 'As contas devem ser diferentes.'); return; }
            if (!valor || valor <= 0 || valor > this.conta.saldos[origem]) { this.exibirPopup('erro', 'Erro', 'Valor inválido ou saldo insuficiente.'); return; }
            this.conta.saldos[origem] -= valor;
            this.conta.saldos[destino] += valor;
            this.adicionarAoExtrato('debito', `Transferência para ${destino}`, valor, 'transferencia');
            this.adicionarAoExtrato('credito', `Transferência da ${origem}`, valor, 'transferencia');
            this.salvarDados(); this.popularTelaMenu(); this.fecharDialogo();
            this.exibirPopup('sucesso', 'Sucesso', 'Transferência entre contas realizada.');
        },

        executarPagamentoFatura() {
            const valor = this.conta.cartaoFaturaAtual;
            if (valor > this.conta.saldos.corrente) { this.exibirPopup('erro', 'Erro', 'Saldo insuficiente para pagar a fatura.'); return; }
            this.conta.saldos.corrente -= valor;
            this.conta.cartaoFaturaAtual = 0;
            this.adicionarAoExtrato('debito', 'Pagamento Fatura do Cartão', valor, 'cartao');
            this.salvarDados(); this.mostrarTela('cartao');
            this.exibirPopup('sucesso', 'Sucesso', 'Fatura paga!');
        },

        executarInvestimento(tipo) {
            const valor = parseFloat(document.getElementById('valor-investimento').value);
            if (!valor || valor <= 0) { this.exibirPopup('erro', 'Erro', 'Valor inválido.'); return; }
            if (tipo === 'aplicar') {
                if (valor > this.conta.saldos.corrente) { this.exibirPopup('erro', 'Erro', 'Saldo insuficiente.'); return; }
                this.conta.saldos.corrente -= valor;
                this.conta.saldoInvestimento += valor;
                this.adicionarAoExtrato('debito', 'Aplicação em Investimento', valor, 'investimento');
                this.exibirPopup('sucesso', 'Sucesso', 'Aplicação realizada!');
            } else {
                if (valor > this.conta.saldoInvestimento) { this.exibirPopup('erro', 'Erro', 'Saldo de investimento insuficiente.'); return; }
                this.conta.saldoInvestimento -= valor;
                this.conta.saldos.corrente += valor;
                this.adicionarAoExtrato('credito', 'Resgate de Investimento', valor, 'investimento');
                this.exibirPopup('sucesso', 'Sucesso', 'Resgate realizado!');
            }
            this.salvarDados(); this.mostrarTela('investimento');
        },

        executarPagamentoEmprestimo() {
            const valor = this.conta.faturaEmprestimo;
            if (valor > this.conta.saldos.corrente) { this.exibirPopup('erro', 'Erro', 'Saldo insuficiente para pagar o empréstimo.'); return; }
            this.conta.saldos.corrente -= valor;
            this.adicionarAoExtrato('debito', 'Pagamento de Empréstimo', valor, 'emprestimo');
            this.conta.emprestimoAtivo = false;
            this.salvarDados(); this.mostrarTela('emprestimo');
            this.exibirPopup('sucesso', 'Sucesso', 'Empréstimo quitado!');
        },

        executarSolicitacaoEmprestimo() {
            const valor = parseFloat(document.getElementById('valor-emprestimo').value);
            if (!valor || valor <= 0) { this.exibirPopup('erro', 'Erro', 'Valor inválido.'); return; }
            this.conta.saldos.corrente += valor;
            this.conta.emprestimoAtivo = true;
            this.conta.valorEmprestimo = valor;
            this.conta.faturaEmprestimo = valor * 1.03; // Juros de 3%
            this.adicionarAoExtrato('credito', 'Recebimento de Empréstimo', valor, 'emprestimo');
            this.salvarDados(); this.mostrarTela('emprestimo');
            this.exibirPopup('sucesso', 'Sucesso', 'Empréstimo creditado em sua conta!');
        },

        criarCartaoVirtual() {
            const novoNumero = `**** **** **** ${Math.floor(1000 + Math.random() * 9000)}`;
            this.conta.cartoes.push({ numero: novoNumero, tipo: 'Virtual', ativo: true });
            this.salvarDados();
            this.mostrarTela('cartao');
            this.exibirPopup('sucesso', 'Sucesso', 'Novo cartão virtual criado!');
        },

        // --- FLUXO DE TRANSFERÊNCIA E PIX ---
        iniciarModal(tipo) {
            const acoes = {
                'deposito': () => this.renderizarModal(`<h3>Depósito (Entre Contas)</h3><select id="deposito-origem"><option value="corrente">Origem: C/C (${this.formatarMoeda(this.conta.saldos.corrente)})</option><option value="poupanca">Origem: Poupança (${this.formatarMoeda(this.conta.saldos.poupanca)})</option></select><select id="deposito-destino"><option value="poupanca">Destino: Poupança</option><option value="corrente">Destino: C/C</option></select><input type="number" id="valor-operacao" placeholder="Valor"><button id="btn-confirmar-deposito" class="primary">Confirmar</button>`),
                'saque': () => this.renderizarModal(`<h3>Saque</h3><select id="saque-origem"><option value="corrente">Origem: C/C (${this.formatarMoeda(this.conta.saldos.corrente)})</option><option value="poupanca">Origem: Poupança (${this.formatarMoeda(this.conta.saldos.poupanca)})</option></select><input type="number" id="valor-operacao" placeholder="Valor"><button id="btn-confirmar-saque" class="primary">Gerar Código</button>`),
                'transferencia': () => this.iniciarTransferencia(),
                'pix': () => this.iniciarPix(),
            };
            if(acoes[tipo]) acoes[tipo]();
        },
        iniciarTransferencia() {
            const conteudo = `<h3>Transferência</h3><p style="margin-bottom: 25px;">O que você deseja fazer?</p><div class="menu-grid" style="grid-template-columns: 1fr 1fr; gap: 15px;"><button id="btn-receber">Receber</button><button id="btn-enviar" class="primary">Enviar Dinheiro</button></div>`;
            this.renderizarModal(conteudo);
        },
        mostrarDadosParaReceber() {
            const conteudo = `<h3>Receber Dinheiro</h3><p>Compartilhe seus dados.</p><div class="content-block" style="text-align: left;"><h4>PIX (Chave CPF)</h4><p><strong>${this.conta.cpf}</strong></p></div><div class="content-block" style="text-align: left;"><h4>TED/DOC</h4><p><strong>Banco:</strong> 333 - BiBank</p><p><strong>Agência:</strong> 0001</p><p><strong>Conta Corrente:</strong> ${this.conta.cpf.slice(-5)}</p></div>`;
            this.renderizarModal(conteudo);
        },
        escolherContaOrigem() {
            const conteudo = `<h3>Enviar - Passo 1/3</h3><p style="margin-bottom: 20px;">De qual conta o dinheiro vai sair?</p><select id="transfer-origem"><option value="corrente">Conta Corrente (${this.formatarMoeda(this.conta.saldos.corrente)})</option><option value="poupanca">Conta Poupança (${this.formatarMoeda(this.conta.saldos.poupanca)})</option></select><button id="btn-avancar-metodo" class="primary">Avançar</button>`;
            this.renderizarModal(conteudo);
        },
        escolherMetodoEnvio(contaOrigem) {
            const conteudo = `<h3>Enviar - Passo 2/3</h3><p style="margin-bottom: 25px;">Qual será a forma de envio?</p><div class="menu-grid" style="grid-template-columns: 1fr 1fr; gap: 15px;"><button id="btn-metodo-pix">PIX</button><button id="btn-metodo-ted">TED</button></div>`;
            this.renderizarModal(conteudo, { contaOrigem: contaOrigem });
        },
        preencherDadosDestino(contaOrigem, metodo) {
            const campos = metodo === 'pix' ? '<input id="chave-pix" placeholder="Chave PIX do destinatário">' : '<input id="agencia-ted" placeholder="Agência (Ex: 0001)"><input id="conta-ted" placeholder="Conta com dígito">';
            const conteudo = `<h3>Enviar - Passo 3/3</h3><p>Transferindo via ${metodo.toUpperCase()}</p><input type="number" id="valor-transferencia" placeholder="R$ 0,00">${campos}<button id="finalizar-transferencia" class="primary">Confirmar</button>`;
            this.renderizarModal(conteudo, { contaOrigem: contaOrigem, metodo: metodo });
        },
        executarTransferencia(contaOrigem, metodo, valor, destinatario) {
            if (!valor || valor <= 0) { this.exibirPopup('erro', 'Erro', 'Insira um valor válido.'); return; }
            if (this.conta.saldos[contaOrigem] < valor) { this.exibirPopup('erro', 'Saldo Insuficiente', `Saldo insuficiente na Conta ${contaOrigem}.`); return; }
            this.conta.saldos[contaOrigem] -= valor;
            this.adicionarAoExtrato('debito', `Transferência ${metodo.toUpperCase()} Enviada`, valor, 'transferencia');
            this.salvarDados(); this.popularTelaMenu(); this.fecharDialogo();
            this.renderizarRecibo(contaOrigem, metodo, valor, destinatario);
        },
        renderizarRecibo(contaOrigem, metodo, valor, destinatario) {
            const conteudo = `<div class="recibo-container printable"><h3>Transferência Realizada!</h3><div class="recibo-content"><p><strong>ID:</strong> BI${Date.now()}</p><p><strong>Valor:</strong> <strong>${this.formatarMoeda(valor)}</strong></p><hr><h4>Origem</h4><p><strong>Nome:</strong> ${this.conta.nome}</p><p><strong>Conta:</strong> Conta ${contaOrigem}</p><hr><h4>Destinatário</h4>${metodo === 'pix' ? `<p><strong>Chave PIX:</strong> ${destinatario.chave}</p>` : `<p><strong>Agência:</strong> ${destinatario.agencia} | <strong>Conta:</strong> ${destinatario.conta}</p>`}</div><div class="recibo-actions"><button id="btn-imprimir" class="primary">Imprimir</button><button id="btn-fechar-recibo">Fechar</button></div></div>`;
            this.renderizarModal(conteudo);
        },
        iniciarPix() {
            const hoje = new Date().toISOString().split('T')[0];
            const conteudo = `<h3>Enviar PIX</h3><select id="pix-origem"><option value="corrente">Saindo da C/C (${this.formatarMoeda(this.conta.saldos.corrente)})</option><option value="poupanca">Saindo da Poupança (${this.formatarMoeda(this.conta.saldos.poupanca)})</option></select><input type="text" id="chave-pix" placeholder="Chave PIX"><input type="number" id="valor-pix" placeholder="Valor (R$)"><label for="data-agendamento">Agendar (opcional):</label><input type="date" id="data-agendamento" min="${hoje}"><button id="btn-confirmar-pix" class="primary">Confirmar PIX</button>`;
            this.renderizarModal(conteudo);
        },
        executarPix(contaOrigem, chave, valor, dataAgendamento) {
            if (!valor || valor <= 0 || !chave) { this.exibirPopup('erro', 'Dados Inválidos', 'Preencha a chave e um valor válido.'); return; }
            if (this.conta.saldos[contaOrigem] < valor) { this.exibirPopup('erro', 'Saldo Insuficiente', `Saldo insuficiente na Conta ${contaOrigem}.`); return; }
            const hoje = new Date(); hoje.setHours(0,0,0,0);
            const agendamento = dataAgendamento ? new Date(dataAgendamento + "T00:00:00") : null;
            if (agendamento && agendamento > hoje) {
                this.conta.pixAgendados.push({ contaOrigem, chave, valor, data: dataAgendamento });
                this.adicionarAoExtrato('debito', `PIX Agendado para ${chave}`, valor, 'pix');
                this.salvarDados(); this.fecharDialogo(); this.renderizarReciboPix(contaOrigem, chave, valor, true, dataAgendamento);
            } else {
                this.conta.saldos[contaOrigem] -= valor;
                this.adicionarAoExtrato('debito', `PIX Enviado para ${chave}`, valor, 'pix');
                this.salvarDados(); this.popularTelaMenu(); this.fecharDialogo(); this.renderizarReciboPix(contaOrigem, chave, valor, false);
            }
        },
        renderizarReciboPix(contaOrigem, chave, valor, agendado, data) {
            const titulo = agendado ? "Agendamento Realizado!" : "Transferência Realizada!";
            const conteudo = `<div class="recibo-container printable"><h3>${titulo}</h3><div class="recibo-content"><p><strong>Valor:</strong> <strong>${this.formatarMoeda(valor)}</strong></p>${agendado ? `<p><strong>Data do Agendamento:</strong> ${new Date(data + "T00:00:00").toLocaleDateString('pt-BR')}</p>` : ''}<hr><h4>Origem</h4><p><strong>Nome:</strong> ${this.conta.nome}</p><p><strong>Conta:</strong> Conta ${contaOrigem}</p><hr><h4>Destinatário</h4><p><strong>Chave PIX:</strong> ${chave}</p></div><div class="recibo-actions"><button id="btn-imprimir" class="primary">Imprimir</button><button id="btn-fechar-recibo">Fechar</button></div></div>`;
            this.renderizarModal(conteudo);
        },

        // --- RENDERIZADOR DE MODAL E EVENTOS ---
        renderizarModal(conteudo, data = {}) {
            const modal = document.getElementById('popup');
            document.getElementById('overlay').style.display = 'block';
            modal.style.display = 'block';
            modal.innerHTML = `<div style="text-align: right; cursor: pointer; font-size: 24px; color: #aaa;" id="modal-close-btn">×</div>${conteudo}`;
            this.adicionarEventosModal(modal, data);
        },

        adicionarEventosModal(modal, data) {
            modal.querySelector('#modal-close-btn')?.addEventListener('click', () => this.fecharDialogo());
            // Transferência
            modal.querySelector('#btn-receber')?.addEventListener('click', () => this.mostrarDadosParaReceber());
            modal.querySelector('#btn-enviar')?.addEventListener('click', () => this.escolherContaOrigem());
            modal.querySelector('#btn-avancar-metodo')?.addEventListener('click', () => this.escolherMetodoEnvio(modal.querySelector('#transfer-origem').value));
            modal.querySelector('#btn-metodo-pix')?.addEventListener('click', () => this.preencherDadosDestino(data.contaOrigem, 'pix'));
            modal.querySelector('#btn-metodo-ted')?.addEventListener('click', () => this.preencherDadosDestino(data.contaOrigem, 'ted'));
            modal.querySelector('#finalizar-transferencia')?.addEventListener('click', () => {
                const valor = parseFloat(modal.querySelector('#valor-transferencia').value);
                let dest = {};
                if (data.metodo === 'pix') { dest.chave = modal.querySelector('#chave-pix').value; }
                else { dest.agencia = modal.querySelector('#agencia-ted').value; dest.conta = modal.querySelector('#conta-ted').value; }
                this.requestPasswordConfirmation(() => this.executarTransferencia(data.contaOrigem, data.metodo, valor, dest));
            });
            // PIX
            modal.querySelector('#btn-confirmar-pix')?.addEventListener('click', () => {
                const pixData = {
                    origem: modal.querySelector('#pix-origem').value,
                    chave: modal.querySelector('#chave-pix').value,
                    valor: parseFloat(modal.querySelector('#valor-pix').value),
                    agendamento: modal.querySelector('#data-agendamento').value
                };
                this.requestPasswordConfirmation(() => this.executarPix(pixData.origem, pixData.chave, pixData.valor, pixData.agendamento));
            });
            // Depósito e Saque
            modal.querySelector('#btn-confirmar-deposito')?.addEventListener('click', () => this.executarDeposito(modal.querySelector('#deposito-origem').value, modal.querySelector('#deposito-destino').value, parseFloat(modal.querySelector('#valor-operacao').value)));
            modal.querySelector('#btn-confirmar-saque')?.addEventListener('click', () => this.requestPasswordConfirmation(() => this.executarSaque(modal.querySelector('#saque-origem').value, parseFloat(modal.querySelector('#valor-operacao').value))));
            // Recibo
            modal.querySelector('#btn-imprimir')?.addEventListener('click', () => window.print());
            modal.querySelector('#btn-fechar-recibo')?.addEventListener('click', () => this.fecharDialogo());
        },

        setupEventListeners() {
            this.setupScreenNavigators(document.body);
            document.getElementById('logout-btn').addEventListener('click', () => { sessionStorage.removeItem('loggedInUserCPF'); window.location.href = 'login.html'; });
            document.getElementById('toggle-saldo-btn').addEventListener('click', () => this.toggleSaldo());
            document.getElementById('overlay').addEventListener('click', () => this.fecharDialogo());
            document.getElementById('confirmar-transacao-btn')?.addEventListener('click', () => {
                const senha = document.getElementById('confirmPassInput').value;
                if (senha === this.conta.senha) { this.fecharDialogo(); if(this.pendingTransactionCallback) this.pendingTransactionCallback(); }
                else { this.exibirPopup('erro', 'Erro', 'Senha incorreta.'); }
            });
        },

        setupScreenNavigators(container) {
            container.querySelectorAll('button[data-screen]').forEach(btn => {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener('click', (e) => {
                    const screen = e.currentTarget.dataset.screen;
                    const modalScreens = { 'transferencia': true, 'pix': true, 'deposito': true, 'saque': true };
                    if (modalScreens[screen]) { this.iniciarModal(screen); } else { this.mostrarTela(screen); }
                });
            });
        },
    };

    BiBankApp.init();
});