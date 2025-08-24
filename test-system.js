// Test System for UltraIntelligence Student Counselor
// Note: Run with 'npm test' to avoid deprecation warnings

const { getConversationResponse, getDataExtractionResponse, extractStudentDataToFile } = require('./index');

async function testSystem() {
    console.log('Testing UltraIntelligence Dual AI System\n');

    // Test conversation AI
    console.log('1. Testing Conversation AI...');
    try {
        const conversationResponse = await getConversationResponse("Hi, I'm interested in computer science and want to get into a good university");
        console.log('Conversation AI Response:', conversationResponse);
    } catch (error) {
        console.log('Conversation AI Error:', error.message);
    }

    console.log('\n2. Testing Data Extraction AI...');
    try {
        const extractedData = await getDataExtractionResponse("Hi, I'm interested in computer science and want to get into a good university");
        console.log('Data Extraction AI Response:', JSON.stringify(extractedData, null, 2));
    } catch (error) {
        console.log('Data Extraction AI Error:', error.message);
    }

    console.log('\n3. Testing Data Extraction to File...');
    try {
        const result = await extractStudentDataToFile();
        if (result) {
            console.log('Data extraction to file successful');
        } else {
            console.log('Data extraction to file skipped (no active student session)');
        }
    } catch (error) {
        console.log('Data extraction to file Error:', error.message);
    }

    console.log('\nSystem test completed!');
}

// Run test if this file is executed directly
if (require.main === module) {
    testSystem().catch(console.error);
}

module.exports = { testSystem };
