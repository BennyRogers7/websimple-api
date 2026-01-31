const nunjucks = require('nunjucks');
const fs = require('fs');
const path = require('path');

// 1. Setup Nunjucks to look at the local templates folder
nunjucks.configure('templates', { autoescape: true });

try {
    // 2. Load the data
    const data = JSON.parse(fs.readFileSync('./sample-gemini-output.json', 'utf8'));
    
    // 3. Render directly
    // Note: Using 'craftsmanship.html' assuming it is inside /templates/
    const html = nunjucks.render('craftsmanship.html', {
        business: data.business || {},
        hero: data.hero || {},
        about: data.about || {},
        services: data.services || [],
        trust: data.trust || {},
        cta: data.cta || {}
    });

    fs.writeFileSync('preview-plumber-output.html', html);
    console.log('✅ Success! File created: preview-plumber-output.html');
} catch (err) {
    console.error('❌ Error:', err.message);
}
