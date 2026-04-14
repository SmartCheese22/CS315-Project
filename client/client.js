import inquirer from 'inquirer';
import axios from 'axios';
import cTable from 'console.table'; // Automatically formats arrays of objects into neat tables

const API_URL = 'http://localhost:5000';

async function mainMenu() {
    console.log('\n===========================================');
    console.log('   🎓 CAMPUS PLACEMENT PORTAL ADMIN 🎓   ');
    console.log('===========================================\n');

    const { choice } = await inquirer.prompt([
        {
            type: 'list',
            name: 'choice',
            message: 'What would you like to do?',
            choices: [
                '1. View Placement Dashboard (Branch Stats)',
                '2. View Company Analytics',
                '3. Track Specific Student',
                '4. Demo Trigger: Accept an Offer (Auto-rejects others)',
                '5. Exit'
            ]
        }
    ]);

    switch (choice.charAt(0)) {
        case '1': await viewDashboard(); break;
        case '2': await viewCompanyStats(); break;
        case '3': await viewStudentTracker(); break;
        case '4': await demoAcceptOffer(); break;
        case '5': 
            console.log("Exiting... Good luck with the DBMS evaluation!");
            process.exit();
    }
}

async function viewDashboard() {
    try {
        const response = await axios.get(`${API_URL}/application/dashboard`);
        console.log('\n--- BRANCH-WISE PLACEMENT DASHBOARD ---');
        console.table(response.data);
    } catch (error) { console.error("Error fetching dashboard:", error.message); }
    await pause();
}

async function viewCompanyStats() {
    try {
        const response = await axios.get(`${API_URL}/company/stats`);
        console.log('\n--- COMPANY RECRUITMENT ANALYTICS ---');
        console.table(response.data);
    } catch (error) { console.error("Error fetching stats:", error.message); }
    await pause();
}

async function viewStudentTracker() {
    const { rollNo } = await inquirer.prompt([
        { type: 'input', name: 'rollNo', message: 'Enter Student Roll No (e.g., 22B0101):' }
    ]);
    
    try {
        const response = await axios.get(`${API_URL}/student/${rollNo}/tracker`);
        if(response.data.length === 0) {
            console.log("\nNo applications found for this student.");
        } else {
            console.log(`\n--- APPLICATION TRACKER FOR ${rollNo} ---`);
            console.table(response.data);
        }
    } catch (error) { console.error("Error fetching tracker:", error.message); }
    await pause();
}

async function demoAcceptOffer() {
    console.log("\n⚠️  This will trigger the DB to auto-reject all other pending apps for the student.");
    const { offerId } = await inquirer.prompt([
        { type: 'input', name: 'offerId', message: 'Enter Offer ID to accept (Hint: Try Offer ID 2):' }
    ]);

    try {
        const response = await axios.put(`${API_URL}/offer/${offerId}/accept`);
        console.log(`\n✅ ${response.data.message}`);
    } catch (error) { console.error("Error accepting offer:", error.message); }
    await pause();
}

async function pause() {
    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press ENTER to return to menu...' }]);
    mainMenu(); // Loop back to the start
}

// Start the app
mainMenu();
