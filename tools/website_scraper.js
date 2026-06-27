const fs = require('fs');
const path = require('path');
const vm = require('vm');
const axios = require('axios');
const cheerio = require('cheerio');

const apiKey = "AIzaSyBjBdMAJisAwQ-P_EixsIMyQ_fxG5ry2m4";

// Targets of key info pages on the college site
const SCRAPE_TARGETS = [
    { name: "Home Page", url: "https://maraugusthinosecollege.org/" },
    { name: "Contact Page", url: "https://maraugusthinosecollege.org/contact-us/" },
    { name: "Placement Page", url: "https://maraugusthinosecollege.org/career-placement/" },
    { name: "Mentoring Page", url: "https://maraugusthinosecollege.org/mentoring-committee/" },
    { name: "Discipline Page", url: "https://maraugusthinosecollege.org/discipline-committee/" },
    { name: "Anti-Ragging Page", url: "https://maraugusthinosecollege.org/anti-ragging-cell/" }
];

const DATABASE_PATH = path.join(__dirname, '..', 'data', 'common', 'mac_ai_database.js');
const STATUS_PATH = path.join(__dirname, '..', 'data', 'common', 'last_scrape.json');

/**
 * Main scraper and extraction task
 */
async function scrapeAndUpdateDatabase() {
    console.log('Starting automated college website scrape task...');
    const allExtractedFaqs = [];

    for (const target of SCRAPE_TARGETS) {
        console.log(`Scraping target [${target.name}]: ${target.url}...`);
        try {
            const response = await axios.get(target.url, { timeout: 10000 });
            const $ = cheerio.load(response.data);
            
            // Remove noise elements
            $('script, style, header, footer, nav, .fusion-header, .fusion-footer, #header, #footer').remove();
            
            const cleanText = $('body').text().replace(/\s+/g, ' ').trim();
            if (cleanText.length < 100) {
                console.warn(`Clean text for ${target.name} is too short, skipping...`);
                continue;
            }

            console.log(`Calling Gemini API to extract FAQs from [${target.name}] (${cleanText.length} chars)...`);
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const prompt = `You are a data extraction assistant. Parse the following scraped text from the Mar Augusthinose College website and extract factual questions and answers (FAQs). 
Each FAQ must be structured as a JSON object:
{
  "keywords": ["keyword1", "keyword2"],
  "answer": "A detailed explanation of the fact, including names, phone numbers, rules, timings, or descriptions."
}

Ensure the answers are highly accurate and formatted in clean markdown. Output a valid JSON array of these objects:
[
  { "keywords": [...], "answer": "..." }
]

Scraped Content:
${cleanText.substring(0, 15000)}`;

            const geminiRes = await axios.post(geminiUrl, {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.2,
                    maxOutputTokens: 8192
                }
            });

            const rawJsonText = geminiRes.data.candidates[0].content.parts[0].text.trim();
            const parsed = JSON.parse(rawJsonText);
            console.log(`Extracted ${parsed.length} FAQs from [${target.name}].`);
            allExtractedFaqs.push(...parsed);
        } catch (err) {
            console.error(`Error scraping target [${target.name}]:`, err.message);
        }
    }

    if (allExtractedFaqs.length === 0) {
        console.warn('No FAQs were successfully extracted during the scrape. Aborting database update.');
        return { success: false, reason: 'No FAQs extracted' };
    }

    console.log(`Scraping complete. Total raw FAQs extracted: ${allExtractedFaqs.length}. Merging with database...`);

    // Load existing database
    let existingFaqs = [];
    try {
        if (fs.existsSync(DATABASE_PATH)) {
            const dbContent = fs.readFileSync(DATABASE_PATH, 'utf-8');
            const sandbox = { window: {} };
            vm.createContext(sandbox);
            vm.runInContext(dbContent, sandbox);
            existingFaqs = sandbox.window.MAC_AI_FAQ || [];
        }
    } catch (dbErr) {
        console.error('Error loading existing database, creating fresh file:', dbErr.message);
    }

    console.log(`Loaded ${existingFaqs.length} existing FAQs.`);

    // Merge FAQs (checking for duplicates based on exact answer matches)
    const mergedFaqs = [...existingFaqs];
    let newEntriesCount = 0;

    for (const newFaq of allExtractedFaqs) {
        if (!newFaq.keywords || !newFaq.answer) continue;
        
        // Trim and clean new FAQ values
        newFaq.answer = newFaq.answer.trim();
        newFaq.keywords = newFaq.keywords.map(k => k.trim().toLowerCase()).filter(Boolean);

        const isDuplicate = mergedFaqs.some(existing => {
            const answerMatch = existing.answer.trim().toLowerCase() === newFaq.answer.toLowerCase();
            return answerMatch;
        });

        if (!isDuplicate) {
            mergedFaqs.push(newFaq);
            newEntriesCount++;
        }
    }

    console.log(`Merged database contains ${mergedFaqs.length} FAQs (${newEntriesCount} new entries added).`);

    // Save combined database back to file
    const outputJs = `// General College Knowledge Database for MacAI
(function () {
    window.MAC_AI_FAQ = ${JSON.stringify(mergedFaqs, null, 8)};
})();
`;

    try {
        fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
        fs.writeFileSync(DATABASE_PATH, outputJs, 'utf-8');
        console.log(`Successfully wrote updated database to ${DATABASE_PATH}`);
        
        // Save last scrape timestamp
        fs.writeFileSync(STATUS_PATH, JSON.stringify({
            lastRun: new Date().toISOString(),
            status: "success",
            newEntries: newEntriesCount,
            totalEntries: mergedFaqs.length
        }, null, 2), 'utf-8');
        
        return { success: true, newEntries: newEntriesCount, totalEntries: mergedFaqs.length };
    } catch (saveErr) {
        console.error('Error saving updated database:', saveErr.message);
        return { success: false, reason: saveErr.message };
    }
}

/**
 * Initializes a monthly scheduler check running once every 24 hours.
 */
function startMonthlyScrapeScheduler() {
    console.log('Initializing monthly automated website scraper scheduler (24-hour tick)...');
    
    // Check immediately on startup
    checkAndScrapeIfNeeded();
    
    // Perform check every 24 hours
    setInterval(checkAndScrapeIfNeeded, 24 * 60 * 60 * 1000);
}

async function checkAndScrapeIfNeeded() {
    try {
        let lastRunDate = null;
        if (fs.existsSync(STATUS_PATH)) {
            const status = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf-8'));
            if (status.lastRun) {
                lastRunDate = new Date(status.lastRun);
            }
        }

        const now = new Date();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        if (!lastRunDate || (now - lastRunDate) > thirtyDaysMs) {
            console.log('Automated check: More than 30 days since last scrape. Triggering scrape now...');
            await scrapeAndUpdateDatabase();
        } else {
            const daysLeft = ((thirtyDaysMs - (now - lastRunDate)) / (24 * 60 * 60 * 1000)).toFixed(1);
            console.log(`Automated check: Next scrape scheduled in ${daysLeft} days.`);
        }
    } catch (err) {
        console.error('Error in scraper schedule checker:', err.message);
    }
}

module.exports = {
    scrapeAndUpdateDatabase,
    startMonthlyScrapeScheduler
};
