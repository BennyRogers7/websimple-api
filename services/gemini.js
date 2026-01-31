// WebSimple AI - Gemini Content Generation (UPDATED)
// Generates rich, professional website content from intake form data

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

/**
 * Generate website content from intake data
 * @param {Object} intakeData - The form fields including industry
 * @param {string} templateId - Which template they chose
 * @returns {Object} Generated content JSON
 */
async function generateContent(intakeData, templateId) {
    const { businessName, phone, email, serviceArea, services, years, industry } = intakeData;
    
    // Industry-specific context for better prompts
    const industryContext = {
        electrician: 'licensed electrical contractor specializing in residential and commercial work',
        plumber: 'professional plumbing company serving homes and businesses',
        hvac: 'heating, ventilation, and air conditioning specialist',
        landscaping: 'landscape design and maintenance professional',
        contractor: 'general contracting and remodeling expert',
        roofing: 'roofing installation and repair specialist',
        cleaning: 'professional cleaning service'
    };
    
    const businessType = industryContext[industry?.toLowerCase()] || 'professional service provider';
    
    const prompt = `You are an expert copywriter creating website content for a ${businessType}. Write compelling, professional content that converts visitors into customers.

BUSINESS DETAILS:
- Business Name: ${businessName}
- Industry: ${industry || 'service provider'}
- Phone: ${phone}
- Email: ${email}
- Service Area: ${serviceArea}
- What They Do: ${services}
- Years in Business: ${years}

CONTENT REQUIREMENTS:
1. **Tone**: Confident, professional, trustworthy - but not corporate or stuffy
2. **Style**: Mix of professional credibility with approachable personality
3. **Service Area**: Naturally mention ${serviceArea} to establish local presence
4. **Experience**: Emphasize ${years} years as proof of reliability and expertise
5. **CTAs**: Action-oriented, benefit-focused (not just "Contact Us")
6. **Formatting**: Normal capitalization (don't force lowercase)

Generate a JSON object with this EXACT structure:

{
    "hero": {
        "headline": "powerful 6-10 word headline that communicates main value proposition",
        "subheadline": "compelling 15-25 word sentence that expands on headline and mentions service area",
        "cta_text": "action-oriented button text, 2-4 words (e.g. 'Get Free Quote', 'Call Today')"
    },
    "about": {
        "headline": "engaging about section headline (e.g. 'Generations of Excellence', 'Your Trusted Local Partner')",
        "text": "3-4 rich sentences about the business story, experience (${years} years), commitment to quality, and what makes them different. Include personality and specific details."
    },
    "services": [
        {
            "title": "specific service name",
            "description": "detailed 2-3 sentence description of this service, benefits, and what's included"
        }
    ],
    "trust": {
        "headline": "why choose us headline that communicates unique value",
        "points": [
            "detailed trust point 1 (5-8 words explaining benefit)",
            "detailed trust point 2 (5-8 words explaining benefit)",
            "detailed trust point 3 (5-8 words explaining benefit)"
        ]
    },
    "cta": {
        "headline": "compelling call-to-action headline that creates urgency",
        "text": "motivating 20-30 word paragraph that gives them a reason to contact now",
        "button_text": "strong action button text"
    },
    "seo": {
        "title": "SEO-optimized page title with business name, main service, and location - under 60 chars",
        "description": "compelling meta description with services, location, and value prop - under 155 chars"
    }
}

IMPORTANT SERVICE PARSING:
- Parse the "What They Do" field carefully
- Create 3-6 individual services based on what they listed
- Each service needs a specific title and detailed description
- Don't just list generic services - make them specific to what they actually do

Return ONLY valid JSON, no markdown formatting, no backticks.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Clean up response (remove any markdown if present)
        let cleanedText = text.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.slice(7);
        }
        if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.slice(3);
        }
        if (cleanedText.endsWith('```')) {
            cleanedText = cleanedText.slice(0, -3);
        }
        cleanedText = cleanedText.trim();
        
        // Parse JSON
        const content = JSON.parse(cleanedText);
        
        // Add business info to the content object
        content.business = {
            name: businessName,
            phone: phone,
            email: email,
            serviceArea: serviceArea,
            years: years,
            industry: industry
        };
        
        content.template = templateId;
        content.generatedAt = new Date().toISOString();
        
        return content;
        
    } catch (error) {
        console.error('Gemini generation error:', error);
        throw new Error('Failed to generate content: ' + error.message);
    }
}

/**
 * Regenerate specific sections (for post-purchase enhancements)
 * @param {Object} existingContent - Current generated content
 * @param {Object} additionalData - New data from enhancement form
 * @returns {Object} Updated content JSON
 */
async function enhanceContent(existingContent, additionalData) {
    const { differentiator, promotion, hours, license } = additionalData;
    
    const prompt = `You are updating website content for an existing business. Here is the current content:

${JSON.stringify(existingContent, null, 2)}

NEW INFORMATION TO INCORPORATE:
${differentiator ? `- What makes them different: ${differentiator}` : ''}
${promotion ? `- Current promotion: ${promotion}` : ''}
${hours ? `- Hours of operation: ${hours}` : ''}
${license ? `- License number: ${license}` : ''}

Update the content to incorporate this new information naturally. Keep the same JSON structure. Make the differentiator a key part of the about section and trust points. If there's a promotion, add it to the hero or CTA section.

Return ONLY valid JSON, no markdown formatting, no backticks.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        let cleanedText = text.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.slice(7);
        }
        if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.slice(3);
        }
        if (cleanedText.endsWith('```')) {
            cleanedText = cleanedText.slice(0, -3);
        }
        cleanedText = cleanedText.trim();
        
        const content = JSON.parse(cleanedText);
        
        // Preserve business info and update timestamp
        content.business = existingContent.business;
        content.template = existingContent.template;
        content.generatedAt = existingContent.generatedAt;
        content.enhancedAt = new Date().toISOString();
        
        // Add the additional data
        if (hours) content.business.hours = hours;
        if (license) content.business.license = license;
        if (promotion) content.promotion = promotion;
        
        return content;
        
    } catch (error) {
        console.error('Gemini enhancement error:', error);
        throw new Error('Failed to enhance content: ' + error.message);
    }
}

module.exports = {
    generateContent,
    enhanceContent
};
