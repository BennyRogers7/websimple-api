// Test Script - Compile Template and View Output
// Run: node test-template.js

const fs = require('fs');
const path = require('path');
const { compileWebsite } = require('./services/compile');

// Load sample content
const sampleContent = require('./sample-gemini-output.json');

console.log('Compiling template with sample content...');

try {
    // Compile the website
    const html = compileWebsite(sampleContent, 'professional', 'electrician');
    
    // Write to test file
    const outputPath = path.join(__dirname, 'test-output.html');
    fs.writeFileSync(outputPath, html);
    
    console.log('✓ Template compiled successfully!');
    console.log(`✓ Output saved to: ${outputPath}`);
    console.log('\nOpen test-output.html in your browser to preview');
    console.log('\nNote: Images won\'t load until you add stock photos to /public/images/ folder');
    
} catch (error) {
    console.error('✗ Compilation failed:', error.message);
    console.error(error);
}
