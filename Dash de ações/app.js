document.addEventListener('DOMContentLoaded', () => {
    const fileUpload = document.getElementById('fileUpload');
    const dashboardArea = document.getElementById('dashboardArea');
    const emptyState = document.getElementById('emptyState');
    const indicatorSelect = document.getElementById('indicatorSelect');
    
    const weekModal = document.getElementById('weekModal');
    const closeModal = document.getElementById('closeModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    const btnGenerateReport = document.getElementById('btnGenerateReport');
    const reportModal = document.getElementById('reportModal');
    const closeReportModal = document.getElementById('closeReportModal');
    const reportTextarea = document.getElementById('reportTextarea');
    const btnCopyReport = document.getElementById('btnCopyReport');
    const reportWeekSelect = document.getElementById('reportWeekSelect');
    
    closeModal.addEventListener('click', () => {
        weekModal.style.display = 'none';
    });
    closeReportModal.addEventListener('click', () => {
        reportModal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === weekModal) weekModal.style.display = 'none';
        if (e.target === reportModal) reportModal.style.display = 'none';
    });
    
    let chartInstance = null;
    let currentWeeklyData = null;
    let currentTotalData = null;
    
    // Configurações Globais do Chart.js para Tema Escuro (Neutral)
    Chart.defaults.color = '#888888';
    Chart.defaults.borderColor = '#2a2a2a';
    Chart.defaults.font.family = "'Inter', sans-serif";

    fileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                processData(json);
            } catch (error) {
                alert('Erro ao ler o arquivo JSON: O arquivo não é um JSON válido.');
                console.error(error);
            }
        };
        reader.readAsText(file);
    });

    function processData(json) {
        // Filtrar semanas duplicadas: priorizando as que têm 'Nome da Loja' não nulo, ou removendo linhas agregadas desnecessárias.
        const weeklyData = json.filter(d => d.Semana !== null && d['Nome da Loja'] !== null);
        const totalData = json.find(d => d.Semana === null); // O Grand Total

        if (weeklyData.length === 0) {
            alert('Nenhum dado semanal válido encontrado no arquivo.');
            return;
        }

        currentWeeklyData = weeklyData;
        currentTotalData = totalData || weeklyData[weeklyData.length - 1];

        dashboardArea.style.display = 'flex';
        emptyState.style.display = 'none';
        btnGenerateReport.style.display = 'inline-block';

        renderKPIs(currentTotalData);
        setupSelect(weeklyData);
        renderTable(weeklyData);
        
        // Reset listener to avoid duplicates
        indicatorSelect.onchange = () => updateChart(weeklyData);
        updateChart(weeklyData); 
    }

    // Helper: converte string "R$1.000,50" ou "-12,6%" para número float
    function parseBRCurrency(str) {
        if(str === null || str === undefined) return 0;
        let s = str.toString().replace('R$', '').replace('%', '').trim();
        // Retira os pontos (separadores de milhar) e troca vírgula por ponto
        s = s.split('.').join('').replace(',', '.');
        return parseFloat(s) || 0;
    }

    function renderKPIs(totals) {
        const kpiContainer = document.getElementById('kpiSummary');
        kpiContainer.innerHTML = '';
        
        const kpis = [
            { label: 'Venda Total', key: 'Venda' },
            { label: 'Meta', key: 'Meta' },
            { label: 'GAP', key: 'GAP' },
            { label: 'Ticket Médio', key: 'Ticket Médio' },
            { label: 'Atingimento', key: 'Ating. Meta (%)' }
        ];

        kpis.forEach(k => {
            const val = totals[k.key] || '-';
            const numVal = parseBRCurrency(val);
            // Identifica cor para GAP (negativo é ruim)
            let valClass = '';
            if (k.key === 'GAP' && numVal < 0) valClass = 'style="color: var(--negative)"';
            
            kpiContainer.innerHTML += `
                <div class="kpi-card">
                    <span class="kpi-label">${k.label}</span>
                    <span class="kpi-value" ${valClass}>${val}</span>
                </div>
            `;
        });
    }

    function setupSelect(data) {
        const excludeKeys = ['Semana', 'Nome da Loja', 'Ating. Meta (%)'];
        const sample = data[0];
        
        // Pegar todas as chaves que não são texto puro e não são variações (para serem as opções principais do gráfico)
        const metrics = Object.keys(sample).filter(k => 
            !excludeKeys.includes(k) && 
            !k.startsWith('Var.') && 
            !k.startsWith('%')
        );

        indicatorSelect.innerHTML = metrics.map(m => `<option value="${m}">${m}</option>`).join('');
    }

    function updateChart(data) {
        const metric = indicatorSelect.value;
        const labels = data.map(d => `Semana ${d.Semana}`);
        const dataset = data.map(d => parseBRCurrency(d[metric]));

        if (chartInstance) {
            chartInstance.destroy();
        }

        const ctx = document.getElementById('mainChart').getContext('2d');
        
        // Define dinamicamente se o gráfico é barra ou linha
        // Para "Venda" e "Meta", barra pode ser melhor, mas usaremos 'line' suavizada por padrão premium.
        
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: metric,
                    data: dataset,
                    borderColor: '#ffffff',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 2,
                    tension: 0.4, // Suaviza a curva
                    fill: true,
                    pointBackgroundColor: '#141414', // Fundo escuro do painel
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1a1a1a',
                        titleColor: '#888888',
                        bodyColor: '#ffffff',
                        borderColor: '#2a2a2a',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                // Recoloca a formatação dependendo da métrica
                                let val = context.parsed.y.toLocaleString('pt-BR');
                                if(metric.includes('Venda') || metric === 'GAP' || metric === 'Meta' || metric.includes('Ticket') || metric.includes('Preço')) {
                                    val = 'R$ ' + val;
                                }
                                return val;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: { 
                            color: '#2a2a2a',
                            drawBorder: false
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#888888' }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
                onClick: (e, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        openModal(data[index]);
                    }
                }
            }
        });
    }

    function renderTable(data) {
        const thead = document.querySelector('#dataTable thead');
        const tbody = document.querySelector('#dataTable tbody');
        
        // Selecionar algumas colunas mais importantes para a tabela
        const cols = [
            'Semana', 
            'Venda', 'Var. Venda', 
            'Ticket Médio', 'Var. Ticket Médio', 
            'Qtd Itens', 'Var. Qtd Itens',
            'GAP', 'Ating. Meta (%)'
        ];
        
        thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;
        
        tbody.innerHTML = data.map((row, index) => {
            return `<tr class="row-clickable" data-index="${index}">
                ${cols.map(c => {
                    let val = row[c] || '-';
                    let cls = '';
                    
                    // Lógica para colorir positivo (verde) e negativo (vermelho)
                    if (c.startsWith('Var.')) {
                        let num = parseBRCurrency(val);
                        if (num > 0) cls = 'val-positive';
                        else if (num < 0) cls = 'val-negative';
                    } else if (c === 'GAP') {
                        let num = parseBRCurrency(val);
                        if (num < 0) cls = 'val-negative';
                        else if (num > 0) cls = 'val-positive';
                    }

                    return `<td class="${cls}">${val}</td>`;
                }).join('')}
            </tr>`;
        }).join('');
        
        document.querySelectorAll('.row-clickable').forEach(tr => {
            tr.addEventListener('click', (e) => {
                const idx = e.currentTarget.getAttribute('data-index');
                openModal(data[idx]);
            });
        });
    }

    function openModal(row) {
        modalTitle.innerText = `Detalhes - Semana ${row.Semana}`;
        modalBody.innerHTML = '';
        
        Object.keys(row).forEach(key => {
            if(key === 'Semana' || key === 'Nome da Loja') return;
            
            let val = row[key] || '-';
            let valClass = '';
            
            if (key.startsWith('Var.')) {
                let num = parseBRCurrency(val);
                if (num > 0) valClass = 'val-positive';
                else if (num < 0) valClass = 'val-negative';
            } else if (key === 'GAP') {
                let num = parseBRCurrency(val);
                if (num < 0) valClass = 'val-negative';
                else if (num > 0) valClass = 'val-positive';
            }
            
            modalBody.innerHTML += `
                <div class="detail-item">
                    <span class="detail-label">${key}</span>
                    <span class="detail-value ${valClass}">${val}</span>
                </div>
            `;
        });
        
        weekModal.style.display = 'flex';
    }

    // Logic for Report Generation
    btnGenerateReport.addEventListener('click', () => {
        if(!currentWeeklyData || !currentTotalData) return;
        
        // Populate select
        reportWeekSelect.innerHTML = `<option value="all">Visão Completa (Todas as semanas)</option>`;
        currentWeeklyData.forEach(d => {
            reportWeekSelect.innerHTML += `<option value="${d.Semana}">Apenas Semana ${d.Semana}</option>`;
        });
        
        reportWeekSelect.value = "all";
        updateReportTextarea();
        reportModal.style.display = 'flex';
    });
    
    reportWeekSelect.addEventListener('change', () => {
        updateReportTextarea();
    });
    
    function updateReportTextarea() {
        const val = reportWeekSelect.value;
        if (val === 'all') {
            reportTextarea.value = generateReportText(currentWeeklyData, currentTotalData);
        } else {
            const weekData = currentWeeklyData.find(d => d.Semana == val);
            if(weekData) {
                reportTextarea.value = generateSingleWeekReportText(weekData);
            }
        }
    }

    btnCopyReport.addEventListener('click', () => {
        reportTextarea.select();
        document.execCommand('copy');
        
        const originalText = btnCopyReport.innerText;
        btnCopyReport.innerText = 'Copiado!';
        setTimeout(() => {
            btnCopyReport.innerText = originalText;
        }, 2000);
    });

    function calculateLY(realizadoStr, varStr, isCurrency) {
        let r = parseBRCurrency(realizadoStr);
        let v = parseBRCurrency(varStr);
        
        if (v === 0) {
            return isCurrency ? `R$ ${r.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : r.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        
        let ly = r / (1 + (v / 100));
        
        if (isCurrency) {
            return 'R$ ' + ly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
            return ly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    }

    function generateReportText(weeklyData, totalData) {
        let storeName = weeklyData[0]['Nome da Loja'] || '';
        let storeNumber = storeName.split('-')[0].trim() || 'Desconhecida';
        let weeks = weeklyData.map(d => d.Semana);
        
        let lines = [];
        lines.push("LOJA");
        lines.push(storeNumber);
        lines.push("Causa Raiz/ Indicador");
        lines.push("AÇÃO");
        
        weeks.forEach(w => {
            lines.push(` Sem ${w}`);
            lines.push(`(   a   )`);
        });
        
        lines.push("Mensal");
        lines.push("GAP");
        lines.push(totalData['GAP'] || '-');
        lines.push("");
        lines.push(`${totalData['Ating. Meta (%)'] || '-'} da meta`);
        
        const addIndicatorBlock = (indicatorCode, dataKey, isCurrency) => {
            lines.push(`${indicatorCode} VS. LY:`);
            lines.push(`${totalData['Var. ' + dataKey] || '-'}`);
            lines.push("");
            lines.push(" Realizado:");
            lines.push(`${totalData[dataKey] || '-'}`);
            lines.push("");
            lines.push("Ano anterior (LY):");
            if(totalData[dataKey] && totalData['Var. ' + dataKey]) {
                lines.push(calculateLY(totalData[dataKey], totalData['Var. ' + dataKey], isCurrency));
            } else {
                lines.push("-");
            }
            lines.push(`[Preencher ação aqui...]`);
            
            weeklyData.forEach(d => {
                lines.push(`${indicatorCode} VS. LY:`);
                lines.push(`${d['Var. ' + dataKey] || '-'}`);
                lines.push("");
                lines.push("Realizado:");
                lines.push(`${d[dataKey] || '-'}`);
                lines.push("");
                lines.push("Ano anterior:");
                if(d[dataKey] && d['Var. ' + dataKey]) {
                    lines.push(calculateLY(d[dataKey], d['Var. ' + dataKey], isCurrency));
                } else {
                    lines.push("-");
                }
            });
        };
        
        addIndicatorBlock('PA', 'PA', false);
        addIndicatorBlock('TKM', 'Ticket Médio', true);
        
        return lines.join('\n');
    }
    
    function generateSingleWeekReportText(weekData) {
        let storeName = weekData['Nome da Loja'] || '';
        let storeNumber = storeName.split('-')[0].trim() || 'Desconhecida';
        let w = weekData.Semana;
        
        let lines = [];
        lines.push("LOJA");
        lines.push(storeNumber);
        lines.push("Causa Raiz/ Indicador");
        lines.push("AÇÃO");
        
        lines.push(` Sem ${w}`);
        lines.push(`(   a   )`);
        
        lines.push("GAP");
        lines.push(weekData['GAP'] || '-');
        lines.push("");
        lines.push(`${weekData['Ating. Meta (%)'] || '-'} da meta`);
        
        const addIndicatorBlock = (indicatorCode, dataKey, isCurrency) => {
            lines.push(`${indicatorCode} VS. LY:`);
            lines.push(`${weekData['Var. ' + dataKey] || '-'}`);
            lines.push("");
            lines.push(" Realizado:");
            lines.push(`${weekData[dataKey] || '-'}`);
            lines.push("");
            lines.push("Ano anterior (LY):");
            if(weekData[dataKey] && weekData['Var. ' + dataKey]) {
                lines.push(calculateLY(weekData[dataKey], weekData['Var. ' + dataKey], isCurrency));
            } else {
                lines.push("-");
            }
            lines.push(`[Preencher ação aqui...]`);
        };
        
        addIndicatorBlock('PA', 'PA', false);
        addIndicatorBlock('TKM', 'Ticket Médio', true);
        
        return lines.join('\n');
    }
});
