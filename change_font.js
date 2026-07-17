const fs = require('fs');
const files = ['oms_monitor_apoio_firefox.user.js', 'oms_monitor_apoio_chrome.user.js', 'ifood_monitor.user.js', 'oms_monitor_mobile.user.js'];
files.forEach(f => {
    if (fs.existsSync(f)) {
        let text = fs.readFileSync(f, 'utf8');
        text = text.replace(/family=Outfit:wght@400;700;900&display=swap/g, 'family=Lilita+One&display=swap');
        text = text.replace(/'Outfit', sans-serif/g, "'Lilita One', cursive");
        fs.writeFileSync(f, text, 'utf8');
        console.log('Updated ' + f);
    }
});
