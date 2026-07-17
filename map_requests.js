const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
    console.log("Conectando ao navegador remoto em localhost:55640...");
    let browser;
    try {
        browser = await puppeteer.connect({
            browserURL: 'http://localhost:55640',
            defaultViewport: null
        });
    } catch (e) {
        console.error("Erro ao conectar ao Chrome. O Chrome está rodando com --remote-debugging-port=55640?");
        process.exit(1);
    }
    
    console.log("Conectado! Buscando a aba do Backoffice Ri Happy...");
    
    const pages = await browser.pages();
    const targetPage = pages.find(p => p.url().includes('backoffice.gruporihappy.com.br'));
    
    if (!targetPage) {
        console.log("Aba da Ri Happy não encontrada! Certifique-se de que ela está aberta.");
        process.exit(1);
    }

    console.log("Aba encontrada:", targetPage.url());
    console.log("Monitorando requisições... Digite/pesquise um produto na tela para capturarmos os dados da API.");
    console.log("O resultado será salvo em requests_log.json. Pressione Ctrl+C no terminal quando terminar.");
    
    const logFile = 'requests_log.json';
    let requestsData = [];
    
    if (fs.existsSync(logFile)) {
        try { requestsData = JSON.parse(fs.readFileSync(logFile, 'utf8')); } catch(e){}
    }
    
    targetPage.on('response', async response => {
        const url = response.url();
        const request = response.request();
        
        // Apenas chamadas XHR/Fetch
        if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
            try {
                const method = request.method();
                const status = response.status();
                const headers = request.headers();
                
                // Vamos focar nas apis que não são estáticas
                if (!url.includes('gruporihappy.com.br') || url.includes('.js') || url.includes('.css')) return;
                
                let postData = request.postData();
                let body = null;
                
                try {
                    const text = await response.text();
                    body = text;
                    try { body = JSON.parse(text); } catch(e){}
                } catch(e) {}
                
                const entry = {
                    time: new Date().toISOString(),
                    method,
                    url,
                    status,
                    requestHeaders: headers,
                    requestBody: postData ? (function(){try{return JSON.parse(postData)}catch(e){return postData}})() : null,
                    responseBody: body
                };
                
                console.log(`=> Capturado: [${method}] ${url} (Status: ${status})`);
                requestsData.push(entry);
                fs.writeFileSync(logFile, JSON.stringify(requestsData, null, 2));
            } catch(e) {
                // ignora erros na leitura (ex: requests interrompidos)
            }
        }
    });
})();
