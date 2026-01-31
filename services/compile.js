// WebSimple AI - Template Compilation Service
// Takes Gemini-generated content + HTML template → Final website HTML

const nunjucks = require('nunjucks');
const path = require('path');

// Configure Nunjucks
const templatePath = path.join(__dirname, '../templates');
nunjucks.configure(templatePath, {
    autoescape: true,
    trimBlocks: true,
    lstripBlocks: true
});

/**
 * Compile a website from generated content
 * @param {Object} generatedContent - JSON from Gemini
 * @param {string} templateId - Which template to use
 * @param {string} industry - Industry type for images
 * @returns {string} Complete HTML
 */
function compileWebsite(generatedContent, templateId = 'electrician', industry = 'electrician') {
    // Map template IDs to file names
    // Map template IDs to file names (by industry)
const templateMap = {
    'electrician': 'electrician.html',
    'plumber': 'electrician.html',
    'hvac': 'electrician.html',
    'roofing': 'electrician.html',
    'landscaping': 'electrician.html',
    'cleaning': 'electrician.html',
    'contractor': 'electrician.html',
    'other': 'electrician.html'
};
    
    const templateFile = templateMap[templateId] || 'electrician.html';
    
    // Prepare template variables
    const templateVars = {
        // Business info
        business: generatedContent.business || {},
        
        // Content sections
        hero: generatedContent.hero || {},
        about: generatedContent.about || {},
        services: generatedContent.services || [],
        trust: generatedContent.trust || {},
        cta: generatedContent.cta || {},
        
        // SEO
        seo: generatedContent.seo || {},
        
        // Images - will pull from /public/images/{industry}/
        images: getImagePaths(industry, templateId),
        
        // Template metadata
        templateId: templateId,
        industry: industry,
        
        // Current year for footer
        currentYear: new Date().getFullYear(),
        
        // Generated timestamp
        generatedAt: generatedContent.generatedAt || new Date().toISOString()
    };
    
    try {
        const html = nunjucks.render(templateFile, templateVars);
        return html;
    } catch (error) {
        console.error('Template compilation error:', error);
        throw new Error(`Failed to compile template: ${error.message}`);
    }
}

/**
 * Get image paths for industry and template combo
 * These map to your curated stock photos
 */
function getImagePaths(industry, templateId) {
    const baseUrl = '/images';
    const ind = industry.toLowerCase();
    
    return {
        hero: `${baseUrl}/${ind}/1.jpg`,
        about: `${baseUrl}/${ind}/2.jpg`,
        service1: `${baseUrl}/${ind}/3.jpg`,
        service2: `${baseUrl}/${ind}/4.jpg`,
        cta: `${baseUrl}/${ind}/1.jpg`
    };
}    
 
/**
 * Compile multi-page site (Pro/Premium tiers)
 * @param {Object} content - All page content
 * @param {Array} pageSelections - Which pages to include
 * @param {string} templateId
 * @param {string} industry
 * @returns {Object} { home: html, about: html, services: html, ... }
 */
function compileMultiPage(content, pageSelections, templateId, industry) {
    const pages = {};
    
    // Always include home page
    pages.home = compileWebsite(content.home, templateId, industry);
    
    // Compile selected pages
    pageSelections.forEach(pageName => {
        if (content[pageName]) {
            const pageTemplate = `${pageName}.html`;
            try {
                pages[pageName] = nunjucks.render(pageTemplate, {
                    business: content.business,
                    content: content[pageName],
                    images: getImagePaths(industry, templateId),
                    templateId,
                    industry,
                    currentYear: new Date().getFullYear()
                });
            } catch (error) {
                console.error(`Failed to compile ${pageName} page:`, error);
            }
        }
    });
    
    return pages;
}

/**
 * Get CSS for template
 */
function getTemplateStyles(templateId) {
    // Each template can have its own CSS file
    // Or use Tailwind classes in the HTML
    return '';
}

module.exports = {
    compileWebsite,
    compileMultiPage,
    getImagePaths,
    getTemplateStyles
};
