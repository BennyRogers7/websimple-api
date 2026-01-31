const fs = require('fs');
const path = require('path');
const { compileWebsite } = require('./services/compile');

const sampleContent = require('./sample-gemini-output.json');

console.log('Compiling template with sample content...');

try {
    let html = compileWebsite(sampleContent, 'professional', 'electrician');
    
    // Fix image paths for local viewing
    html = html.replace(/src="\/images\//g, 'src="public/images/');
    
    const outputPath = path.join(__dirname, 'test-output.html');
    fs.writeFileSync(outputPath, html);
    
    console.log('✓ Template compiled successfully!');
    console.log(`✓ Output saved to: ${outputPath}`);
    console.log('\nOpening in browser...');
    
} catch (error) {
    console.error('✗ Compilation failed:', error.message);
}
