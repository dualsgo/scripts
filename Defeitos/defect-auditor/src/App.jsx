import { useState, useRef, useEffect } from 'react';
import * as xlsx from 'xlsx';
import { UploadCloud, Barcode, CheckCircle, AlertTriangle, FileSpreadsheet, ArrowRight, Download, RefreshCw, ChevronRight } from 'lucide-react';
import './index.css';

function App() {
  const [screen, setScreen] = useState('setup'); // setup, scanning, report
  const [originalData, setOriginalData] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [selectedDeposit, setSelectedDeposit] = useState('');
  
  // Scanned counts: { "ean_or_sap_or_id": count }
  const [scannedItems, setScannedItems] = useState({});
  const [lastScanned, setLastScanned] = useState(null);

  // Setup Screen
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const dataBuffer = new Uint8Array(evt.target.result);
        const wb = xlsx.read(dataBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Obter os dados brutos (usamos raw: false para garantir formatação)
        const data = xlsx.utils.sheet_to_json(ws, { defval: '' });
        
        if (data.length === 0) {
          alert('A planilha parece estar vazia ou a primeira aba não tem dados.');
          return;
        }

        // Tentar encontrar as colunas ignorando possíveis espaços extras
        const formattedData = data.map(row => {
          // Função helper para buscar chave por parte do nome (case insensitive)
          const findKey = (search) => Object.keys(row).find(k => k.toLowerCase().includes(search.toLowerCase()));
          
          const keyEan = findKey('EAN') || findKey('UPC');
          const keySap = findKey('SAP');
          const keyDesc = findKey('DESCRI');
          const keyDep = findKey('DEP');
          const keyQtd = findKey('QUANTIDADE') || findKey('QTD');
          const keyForn = findKey('NOME FORN') || findKey('FORNECEDOR');

          return {
            ean: keyEan ? String(row[keyEan]).trim() : '',
            sap: keySap ? String(row[keySap]).trim() : '',
            descricao: keyDesc ? String(row[keyDesc]) : '',
            deposito: keyDep ? String(row[keyDep]).trim() : '',
            quantidade: keyQtd ? Number(row[keyQtd]) || 0 : 0,
            fornecedor: keyForn ? String(row[keyForn]) : '',
            id: (keySap ? row[keySap] : null) || (keyEan ? row[keyEan] : null) || Math.random().toString(36).substring(7)
          };
        });

        // Filtrar linhas vazias (sem EAN, SAP e sem descrição)
        const validData = formattedData.filter(item => item.ean || item.sap || item.descricao);

        if (validData.length === 0) {
          alert('Nenhum dado válido encontrado nas colunas (EAN/SAP/Depósito). Verifique o formato da planilha.');
          return;
        }

        setOriginalData(validData);
        
        // Extract unique deposits
        const uniqueDeposits = [...new Set(validData.map(item => item.deposito))].filter(Boolean);
        setDeposits(uniqueDeposits);
        
        if (uniqueDeposits.length === 0) {
          alert('Aviso: Nenhum "Depósito" encontrado na planilha.');
        } else if (uniqueDeposits.length === 1) {
          setSelectedDeposit(uniqueDeposits[0]);
        }
      } catch (err) {
        console.error(err);
        alert('Erro ao ler o arquivo: ' + err.message);
      }
    };
    reader.onerror = () => alert('Erro na leitura do arquivo pelo navegador.');
    reader.readAsArrayBuffer(file);
    
    // Reset o valor do input para permitir fazer upload do mesmo arquivo caso falhe
    e.target.value = null;
  };

  const startScanning = () => {
    if (originalData.length === 0 || !selectedDeposit) {
      alert("Por favor, carregue a planilha e selecione o depósito.");
      return;
    }
    setScreen('scanning');
  };

  // Scanning Screen
  const handleScan = (code) => {
    if (!code) return;
    
    // Find item by EAN or SAP
    const foundItem = originalData.find(
      item => (String(item.ean) === code || String(item.sap) === code) && item.deposito === selectedDeposit
    );

    const scanId = foundItem ? foundItem.id : `UNKNOWN-${code}`;
    
    setScannedItems(prev => ({
      ...prev,
      [scanId]: (prev[scanId] || 0) + 1
    }));
    
    setLastScanned({
      code,
      found: !!foundItem,
      name: foundItem ? foundItem.descricao : 'Item não encontrado no Depósito'
    });
  };

  const finishScanning = () => {
    setScreen('report');
  };

  // Report Screen
  const exportReport = () => {
    // Generate differences
    const expectedForDeposit = originalData.filter(item => item.deposito === selectedDeposit);
    
    const reportData = expectedForDeposit.map(item => {
      const scannedCount = scannedItems[item.id] || 0;
      const expectedCount = item.quantidade;
      const difference = scannedCount - expectedCount;
      let status = "Igual";
      if (difference > 0) status = "A Mais (Adicionar)";
      if (difference < 0) status = "A Menos (Ajustar)";
      
      return {
        'Código EAN/UPC': item.ean,
        'SAP': item.sap,
        'DESCRIÇÃO': item.descricao,
        'DEPÓSITO': item.deposito,
        'QUANTIDADE ESPERADA': expectedCount,
        'QUANTIDADE ESCANEADA': scannedCount,
        'DIFERENÇA': difference,
        'STATUS AUDITORIA': status,
        'FORNECEDOR': item.fornecedor,
        'NOME FORNECEDOR': item.nomeFornecedor
      };
    });

    // Add unknown scanned items
    Object.keys(scannedItems).forEach(key => {
      if (key.startsWith('UNKNOWN-')) {
        const code = key.replace('UNKNOWN-', '');
        reportData.push({
          'Código EAN/UPC': code,
          'SAP': '',
          'DESCRIÇÃO': 'ITEM NÃO CADASTRADO NO DEPÓSITO',
          'DEPÓSITO': selectedDeposit,
          'QUANTIDADE ESPERADA': 0,
          'QUANTIDADE ESCANEADA': scannedItems[key],
          'DIFERENÇA': scannedItems[key],
          'STATUS AUDITORIA': 'A Mais (Não Encontrado)',
          'FORNECEDOR': '',
          'NOME FORNECEDOR': ''
        });
      }
    });

    const ws = xlsx.utils.json_to_sheet(reportData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Auditoria");
    xlsx.writeFile(wb, `Auditoria_Deposito_${selectedDeposit}.xlsx`);
  };

  const resetSystem = () => {
    if(confirm("Tem certeza que deseja recomeçar? Todo o progresso não exportado será perdido.")){
      setScreen('setup');
      setOriginalData([]);
      setDeposits([]);
      setSelectedDeposit('');
      setScannedItems({});
      setLastScanned(null);
    }
  };

  // Sub-components rendering
  const renderSetup = () => (
    <div className="surface" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="text-center mb-4">
        <UploadCloud size={48} className="upload-icon mx-auto" />
        <h2>Configuração da Auditoria</h2>
        <p className="text-muted">Importe a planilha de defeitos para começar</p>
      </div>

      <div className="upload-zone" onClick={() => document.getElementById('fileUpload').click()}>
        <FileSpreadsheet size={32} className="upload-icon" style={{ margin: '0 auto' }} />
        {originalData.length > 0 ? (
          <div>
            <h3 style={{ color: 'var(--success)' }}>Planilha Carregada!</h3>
            <p>{originalData.length} itens encontrados</p>
          </div>
        ) : (
          <div>
            <h3>Clique para selecionar a planilha</h3>
            <p className="text-muted">Formato .xlsx</p>
          </div>
        )}
        <input 
          id="fileUpload" 
          type="file" 
          accept=".xlsx, .xls" 
          style={{ display: 'none' }} 
          onChange={handleFileUpload} 
        />
      </div>

      {deposits.length > 0 && (
        <div className="input-group mt-4">
          <label className="input-label">Selecione o Depósito para Conferência:</label>
          <select 
            className="input-field" 
            value={selectedDeposit} 
            onChange={(e) => setSelectedDeposit(e.target.value)}
          >
            <option value="">-- Escolha um depósito --</option>
            {deposits.map(dep => (
              <option key={dep} value={dep}>Depósito {dep}</option>
            ))}
          </select>
        </div>
      )}

      <button 
        className="btn btn-primary w-full mt-4" 
        onClick={startScanning}
        disabled={originalData.length === 0 || !selectedDeposit}
      >
        Iniciar Conferência <ArrowRight size={20} />
      </button>
    </div>
  );

  const renderScanning = () => {
    const inputRef = useRef(null);
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
      // Keep focus on input
      if (inputRef.current) inputRef.current.focus();
      const interval = setInterval(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus();
        }
      }, 1000);
      return () => clearInterval(interval);
    }, []);

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        handleScan(inputValue.trim());
        setInputValue('');
      }
    };

    const expectedForDeposit = originalData.filter(item => item.deposito === selectedDeposit);
    const totalExpected = expectedForDeposit.reduce((acc, curr) => acc + curr.quantidade, 0);
    const totalScanned = Object.values(scannedItems).reduce((acc, curr) => acc + curr, 0);

    return (
      <div className="flex gap-4" style={{ alignItems: 'flex-start' }}>
        <div className="surface" style={{ flex: 1 }}>
          <div className="flex justify-between items-center mb-4">
            <h2>Escaneamento - Depósito {selectedDeposit}</h2>
            <button className="btn btn-success" onClick={finishScanning}>
              Finalizar <CheckCircle size={20} />
            </button>
          </div>
          
          <div className="scanner-input-container">
            <input 
              ref={inputRef}
              type="text" 
              className="input-field scanner-input scanner-pulse" 
              placeholder="Bipe o EAN ou SAP aqui..." 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          {lastScanned && (
            <div className={`surface mt-4 text-center ${lastScanned.found ? 'bg-success-light' : 'bg-danger-light'}`} style={{ backgroundColor: lastScanned.found ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
              {lastScanned.found ? (
                <CheckCircle size={48} color="var(--success)" style={{ margin: '0 auto' }} />
              ) : (
                <AlertTriangle size={48} color="var(--danger)" style={{ margin: '0 auto' }} />
              )}
              <h3 className="mt-4">{lastScanned.code}</h3>
              <p style={{ fontWeight: 600, fontSize: '1.2rem' }}>{lastScanned.name}</p>
            </div>
          )}
        </div>

        <div className="surface" style={{ width: '350px' }}>
          <h3>Resumo</h3>
          <div className="flex justify-between mt-4">
            <span className="text-muted">Total Esperado:</span>
            <strong>{totalExpected}</strong>
          </div>
          <div className="flex justify-between mt-4">
            <span className="text-muted">Total Escaneado:</span>
            <strong>{totalScanned}</strong>
          </div>

          <h4 className="mt-4 mb-4">Últimos itens escaneados</h4>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {Object.entries(scannedItems).reverse().slice(0, 5).map(([id, count]) => {
              const item = originalData.find(i => i.id === id);
              const name = item ? item.descricao : `Desconhecido (${id.replace('UNKNOWN-', '')})`;
              return (
                <div key={id} className="flex justify-between items-center mb-4" style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.875rem' }}>
                    <div style={{ fontWeight: 600 }}>{name.substring(0, 25)}...</div>
                  </div>
                  <div className="badge badge-success">{count}x</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderReport = () => {
    const expectedForDeposit = originalData.filter(item => item.deposito === selectedDeposit);
    
    const differences = expectedForDeposit.map(item => {
      const scannedCount = scannedItems[item.id] || 0;
      return {
        ...item,
        scannedCount,
        diff: scannedCount - item.quantidade
      };
    });

    // Add unknowns
    Object.keys(scannedItems).forEach(key => {
      if (key.startsWith('UNKNOWN-')) {
        differences.push({
          ean: key.replace('UNKNOWN-', ''),
          sap: '-',
          descricao: 'NÃO CADASTRADO NO DEPÓSITO',
          quantidade: 0,
          scannedCount: scannedItems[key],
          diff: scannedItems[key],
          isUnknown: true
        });
      }
    });

    const aMais = differences.filter(d => d.diff > 0);
    const aMenos = differences.filter(d => d.diff < 0);
    const iguais = differences.filter(d => d.diff === 0);

    return (
      <div className="surface">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2>Relatório de Diferenças</h2>
            <p className="text-muted">Depósito {selectedDeposit}</p>
          </div>
          <div className="flex gap-4">
            <button className="btn btn-outline" onClick={resetSystem}>
              <RefreshCw size={20} /> Nova Auditoria
            </button>
            <button className="btn btn-primary" onClick={exportReport}>
              <Download size={20} /> Exportar Excel
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-4">
          <div className="surface flex-1 text-center" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>
            <h3>A Mais</h3>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{aMais.length}</div>
            <p>Sugerido Adicionar</p>
          </div>
          <div className="surface flex-1 text-center" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}>
            <h3>A Menos</h3>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{aMenos.length}</div>
            <p>Sugerido Ajustar</p>
          </div>
          <div className="surface flex-1 text-center" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
            <h3>Iguais</h3>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{iguais.length}</div>
            <p>Tudo Certo</p>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código (EAN/SAP)</th>
                <th>Descrição</th>
                <th>Esperado</th>
                <th>Físico</th>
                <th>Diferença</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {differences.sort((a, b) => b.diff - a.diff).map((item, idx) => (
                <tr key={idx}>
                  <td>{item.ean || item.sap}</td>
                  <td>{item.descricao}</td>
                  <td>{item.quantidade}</td>
                  <td>{item.scannedCount}</td>
                  <td style={{ fontWeight: 600, color: item.diff > 0 ? 'var(--danger)' : item.diff < 0 ? 'var(--warning)' : 'var(--success)' }}>
                    {item.diff > 0 ? `+${item.diff}` : item.diff}
                  </td>
                  <td>
                    {item.diff > 0 && <span className="badge badge-danger">Adicionar</span>}
                    {item.diff < 0 && <span className="badge badge-warning">Ajustar</span>}
                    {item.diff === 0 && <span className="badge badge-success">OK</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Sistema de Auditoria de Defeitos</h1>
        <p>Conferência física com leitor de código de barras</p>
      </header>

      <main>
        {screen === 'setup' && renderSetup()}
        {screen === 'scanning' && renderScanning()}
        {screen === 'report' && renderReport()}
      </main>
    </div>
  );
}

export default App;
